import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocket, WebSocketServer } from 'ws';
import {
  createInitialState,
  executeMoveOnState,
  findMatchingLegalMove,
  type GameState,
  type PieceColor,
} from './src/shared/chessEngine.ts';
import type {
  ChatMessage,
  ClientMessage,
  OnlineRoomSnapshot,
  RoomSummary,
  ServerMessage,
} from './src/shared/protocol.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ClientMeta {
  ws: WebSocket;
  playerToken: string | null;
  roomCode: string | null;
  inLobby: boolean;
}

interface PlayerSlot {
  name: string;
  token: string;
  ws: WebSocket | null;
  connected: boolean;
}

interface ServerRoom {
  code: string;
  isPublic: boolean;
  status: 'waiting' | 'playing' | 'finished';
  timeMinutes: number;
  players: {
    w: PlayerSlot | null;
    b: PlayerSlot | null;
  };
  spectators: Map<string, WebSocket>;
  drawOfferBy: PieceColor | null;
  rematchVotes: { w: boolean; b: boolean };
  gameState: GameState;
  chat: ChatMessage[];
  createdAt: number;
  lastActivityAt: number;
  lastTickAt: number;
}

interface QueueEntry {
  ws: WebSocket;
  playerName: string;
  timeMinutes: number;
  playerToken: string;
  queuedAt: number;
}

const ALLOWED_TIMES = new Set([0, 3, 5, 10, 15]);
const rooms = new Map<string, ServerRoom>();
const clients = new Map<WebSocket, ClientMeta>();
const matchmakingQueue: QueueEntry[] = [];

function sanitizeName(raw: string): string {
  const cleaned = String(raw || '').trim().slice(0, 24);
  return cleaned || 'لاعب';
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function sendJson(ws: WebSocket | null | undefined, msg: ServerMessage): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify(msg));
  } catch {
    // Ignore transient socket send failures
  }
}

function toSnapshot(room: ServerRoom): OnlineRoomSnapshot {
  return {
    code: room.code,
    status: room.status,
    timeMinutes: room.timeMinutes,
    players: {
      w: room.players.w
        ? { name: room.players.w.name, connected: room.players.w.connected }
        : null,
      b: room.players.b
        ? { name: room.players.b.name, connected: room.players.b.connected }
        : null,
    },
    spectatorsCount: room.spectators.size,
    drawOfferBy: room.drawOfferBy,
    rematchVotes: { ...room.rematchVotes },
    gameState: room.gameState,
    chat: room.chat,
    lastSyncAt: Date.now(),
  };
}

function getRoomRecipients(room: ServerRoom): WebSocket[] {
  const list: WebSocket[] = [];
  if (room.players.w?.ws) list.push(room.players.w.ws);
  if (room.players.b?.ws) list.push(room.players.b.ws);
  for (const specWs of room.spectators.values()) {
    list.push(specWs);
  }
  return list;
}

function broadcastRoom(room: ServerRoom, msg: ServerMessage): void {
  for (const ws of getRoomRecipients(room)) {
    sendJson(ws, msg);
  }
}

function addSystemChat(room: ServerRoom, text: string): void {
  const message: ChatMessage = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    senderName: 'النظام',
    senderRole: 'system',
    text,
    timestamp: Date.now(),
  };
  room.chat.push(message);
  if (room.chat.length > 60) room.chat.shift();
  broadcastRoom(room, { type: 'room:chat', message });
}

function broadcastLobby(): void {
  const openRooms: RoomSummary[] = [];
  for (const room of rooms.values()) {
    if (!room.isPublic || room.status !== 'waiting') continue;
    const count = (room.players.w ? 1 : 0) + (room.players.b ? 1 : 0);
    if (count < 2) {
      openRooms.push({
        code: room.code,
        hostName: room.players.w?.name || room.players.b?.name || 'لاعب',
        timeMinutes: room.timeMinutes,
        playersCount: count,
        createdAt: room.createdAt,
        status: room.status,
      });
    }
  }
  openRooms.sort((a, b) => b.createdAt - a.createdAt);

  const payload: ServerMessage = {
    type: 'lobby:update',
    onlineCount: clients.size,
    queueCount: matchmakingQueue.length,
    openRooms: openRooms.slice(0, 12),
  };

  for (const meta of clients.values()) {
    if (meta.inLobby) {
      sendJson(meta.ws, payload);
    }
  }
}

function tickRoomClock(room: ServerRoom): boolean {
  const now = Date.now();
  const dt = Math.max(0, (now - room.lastTickAt) / 1000);
  room.lastTickAt = now;

  if (
    room.status !== 'playing' ||
    room.timeMinutes === 0 ||
    !room.gameState.started ||
    room.gameState.over
  ) {
    return false;
  }

  const turn = room.gameState.turn;
  room.gameState.clocks[turn] = Math.max(0, room.gameState.clocks[turn] - dt);

  if (room.gameState.clocks[turn] <= 0) {
    room.gameState.clocks[turn] = 0;
    room.gameState.over = true;
    room.gameState.winner = turn === 'w' ? 'b' : 'w';
    room.gameState.resultText =
      turn === 'w'
        ? 'انتهى وقت الأبيض — الأسود فاز'
        : 'انتهى وقت الأسود — الأبيض فاز';
    room.status = 'finished';
    addSystemChat(room, room.gameState.resultText);
    broadcastRoom(room, { type: 'room:state', snapshot: toSnapshot(room) });
    return true;
  }

  return false;
}

function removeFromQueue(ws: WebSocket): boolean {
  const idx = matchmakingQueue.findIndex((q) => q.ws === ws);
  if (idx >= 0) {
    matchmakingQueue.splice(idx, 1);
    return true;
  }
  return false;
}

function detachFromRoom(meta: ClientMeta): void {
  if (!meta.roomCode) return;
  const room = rooms.get(meta.roomCode);
  meta.roomCode = null;
  if (!room) return;

  if (room.players.w?.ws === meta.ws) {
    room.players.w.ws = null;
    room.players.w.connected = false;
  }
  if (room.players.b?.ws === meta.ws) {
    room.players.b.ws = null;
    room.players.b.connected = false;
  }
  if (meta.playerToken) {
    room.spectators.delete(meta.playerToken);
  }

  room.lastActivityAt = Date.now();
  broadcastRoom(room, { type: 'room:state', snapshot: toSnapshot(room) });
}

function getRoleInRoom(room: ServerRoom, playerToken: string): PieceColor | 'spectator' {
  if (room.players.w?.token === playerToken) return 'w';
  if (room.players.b?.token === playerToken) return 'b';
  return 'spectator';
}

function handleMessage(ws: WebSocket, raw: string): void {
  const meta = clients.get(ws);
  if (!meta) return;

  let msg: ClientMessage;
  try {
    msg = JSON.parse(raw) as ClientMessage;
  } catch {
    sendJson(ws, { type: 'error', message: 'صيغة رسالة غير صالحة' });
    return;
  }

  switch (msg.type) {
    case 'ping': {
      sendJson(ws, { type: 'pong' });
      return;
    }

    case 'lobby:subscribe': {
      meta.inLobby = true;
      broadcastLobby();
      return;
    }

    case 'lobby:unsubscribe': {
      meta.inLobby = false;
      return;
    }

    case 'matchmaking:join': {
      meta.playerToken = msg.playerToken;
      removeFromQueue(ws);
      detachFromRoom(meta);

      const timeMinutes = ALLOWED_TIMES.has(msg.timeMinutes) ? msg.timeMinutes : 10;
      const playerName = sanitizeName(msg.playerName);

      const matchIdx = matchmakingQueue.findIndex(
        (entry) =>
          entry.timeMinutes === timeMinutes &&
          entry.playerToken !== msg.playerToken &&
          entry.ws.readyState === WebSocket.OPEN
      );

      if (matchIdx >= 0) {
        const opponent = matchmakingQueue.splice(matchIdx, 1)[0];
        const code = generateRoomCode();
        const firstIsWhite = Math.random() < 0.5;
        const wSlot: PlayerSlot = firstIsWhite
          ? { name: playerName, token: msg.playerToken, ws, connected: true }
          : {
              name: opponent.playerName,
              token: opponent.playerToken,
              ws: opponent.ws,
              connected: true,
            };
        const bSlot: PlayerSlot = firstIsWhite
          ? {
              name: opponent.playerName,
              token: opponent.playerToken,
              ws: opponent.ws,
              connected: true,
            }
          : { name: playerName, token: msg.playerToken, ws, connected: true };

        const room: ServerRoom = {
          code,
          isPublic: false,
          status: 'playing',
          timeMinutes,
          players: { w: wSlot, b: bSlot },
          spectators: new Map(),
          drawOfferBy: null,
          rematchVotes: { w: false, b: false },
          gameState: createInitialState(timeMinutes),
          chat: [],
          createdAt: Date.now(),
          lastActivityAt: Date.now(),
          lastTickAt: Date.now(),
        };
        rooms.set(code, room);

        meta.roomCode = code;
        const oppMeta = clients.get(opponent.ws);
        if (oppMeta) oppMeta.roomCode = code;

        addSystemChat(
          room,
          `بدأت المباراة بين ${wSlot.name} (الأبيض) و ${bSlot.name} (الأسود)`
        );

        const snap = toSnapshot(room);
        sendJson(wSlot.ws, { type: 'room:joined', role: 'w', snapshot: snap });
        sendJson(bSlot.ws, { type: 'room:joined', role: 'b', snapshot: snap });
        broadcastLobby();
      } else {
        matchmakingQueue.push({
          ws,
          playerName,
          timeMinutes,
          playerToken: msg.playerToken,
          queuedAt: Date.now(),
        });
        sendJson(ws, { type: 'matchmaking:waiting', timeMinutes });
        broadcastLobby();
      }
      return;
    }

    case 'matchmaking:leave': {
      if (removeFromQueue(ws)) {
        sendJson(ws, { type: 'matchmaking:cancelled' });
        broadcastLobby();
      }
      return;
    }

    case 'room:create': {
      meta.playerToken = msg.playerToken;
      removeFromQueue(ws);
      detachFromRoom(meta);

      const timeMinutes = ALLOWED_TIMES.has(msg.timeMinutes) ? msg.timeMinutes : 10;
      const playerName = sanitizeName(msg.playerName);
      const code = generateRoomCode();
      const color: PieceColor =
        msg.preferredColor === 'random'
          ? Math.random() < 0.5
            ? 'w'
            : 'b'
          : msg.preferredColor;

      const slot: PlayerSlot = {
        name: playerName,
        token: msg.playerToken,
        ws,
        connected: true,
      };

      const room: ServerRoom = {
        code,
        isPublic: !!msg.isPublic,
        status: 'waiting',
        timeMinutes,
        players: {
          w: color === 'w' ? slot : null,
          b: color === 'b' ? slot : null,
        },
        spectators: new Map(),
        drawOfferBy: null,
        rematchVotes: { w: false, b: false },
        gameState: createInitialState(timeMinutes),
        chat: [],
        createdAt: Date.now(),
        lastActivityAt: Date.now(),
        lastTickAt: Date.now(),
      };
      rooms.set(code, room);
      meta.roomCode = code;

      addSystemChat(room, `أنشأ ${playerName} الغرفة ${code}. بانتظار انضمام المنافس...`);
      sendJson(ws, {
        type: 'room:joined',
        role: color,
        snapshot: toSnapshot(room),
      });
      broadcastLobby();
      return;
    }

    case 'room:join': {
      meta.playerToken = msg.playerToken;
      removeFromQueue(ws);

      const code = String(msg.code || '').trim().toUpperCase();
      const room = rooms.get(code);
      if (!room) {
        sendJson(ws, {
          type: 'error',
          message: `لم يتم العثور على غرفة بالكود ${code}`,
        });
        return;
      }

      if (meta.roomCode && meta.roomCode !== code) {
        detachFromRoom(meta);
      }

      const playerName = sanitizeName(msg.playerName);
      meta.roomCode = code;
      room.lastActivityAt = Date.now();

      // 1. Check reconnect into existing slot
      if (room.players.w?.token === msg.playerToken) {
        room.players.w.ws = ws;
        room.players.w.connected = true;
        room.players.w.name = playerName;
        sendJson(ws, {
          type: 'room:joined',
          role: 'w',
          snapshot: toSnapshot(room),
        });
        broadcastRoom(room, { type: 'room:state', snapshot: toSnapshot(room) });
        return;
      }
      if (room.players.b?.token === msg.playerToken) {
        room.players.b.ws = ws;
        room.players.b.connected = true;
        room.players.b.name = playerName;
        sendJson(ws, {
          type: 'room:joined',
          role: 'b',
          snapshot: toSnapshot(room),
        });
        broadcastRoom(room, { type: 'room:state', snapshot: toSnapshot(room) });
        return;
      }

      // 2. Claim open seat if waiting
      let assignedRole: PieceColor | 'spectator' = 'spectator';
      if (!room.players.w) {
        room.players.w = { name: playerName, token: msg.playerToken, ws, connected: true };
        assignedRole = 'w';
      } else if (!room.players.b) {
        room.players.b = { name: playerName, token: msg.playerToken, ws, connected: true };
        assignedRole = 'b';
      } else {
        room.spectators.set(msg.playerToken, ws);
      }

      if (room.players.w && room.players.b && room.status === 'waiting') {
        room.status = 'playing';
        room.lastTickAt = Date.now();
        addSystemChat(
          room,
          `انضم ${playerName} — بدأت المباراة (${room.players.w.name} ضد ${room.players.b.name})`
        );
      } else if (assignedRole === 'spectator') {
        addSystemChat(room, `انضم ${playerName} كمشاهد`);
      }

      const snap = toSnapshot(room);
      sendJson(ws, { type: 'room:joined', role: assignedRole, snapshot: snap });
      broadcastRoom(room, { type: 'room:state', snapshot: snap });
      broadcastLobby();
      return;
    }

    case 'room:leave': {
      detachFromRoom(meta);
      broadcastLobby();
      return;
    }

    case 'game:move': {
      const room = rooms.get(msg.code);
      if (!room) {
        sendJson(ws, { type: 'error', message: 'الغرفة غير موجودة' });
        return;
      }
      if (room.status !== 'playing' || room.gameState.over) {
        sendJson(ws, { type: 'error', message: 'المباراة ليست قيد اللعب حالياً' });
        return;
      }

      const role = getRoleInRoom(room, msg.playerToken);
      if (role !== room.gameState.turn) {
        sendJson(ws, { type: 'error', message: 'ليس دورك الآن' });
        sendJson(ws, { type: 'room:state', snapshot: toSnapshot(room) });
        return;
      }

      const timedOut = tickRoomClock(room);
      if (timedOut) return;

      const legalMove = findMatchingLegalMove(
        room.gameState,
        msg.from,
        msg.to,
        msg.promotion || null
      );
      if (!legalMove) {
        sendJson(ws, { type: 'error', message: 'نقلة غير قانونية' });
        sendJson(ws, { type: 'room:state', snapshot: toSnapshot(room) });
        return;
      }

      const { nextState } = executeMoveOnState(room.gameState, legalMove, false);
      room.gameState = nextState;
      room.drawOfferBy = null;
      room.lastActivityAt = Date.now();
      room.lastTickAt = Date.now();

      if (nextState.over) {
        room.status = 'finished';
        if (nextState.resultText) {
          addSystemChat(room, nextState.resultText);
        }
      }

      broadcastRoom(room, { type: 'room:state', snapshot: toSnapshot(room) });
      return;
    }

    case 'game:resign': {
      const room = rooms.get(msg.code);
      if (!room || room.status !== 'playing' || room.gameState.over) return;
      const role = getRoleInRoom(room, msg.playerToken);
      if (role !== 'w' && role !== 'b') return;

      tickRoomClock(room);
      room.gameState.over = true;
      room.gameState.winner = role === 'w' ? 'b' : 'w';
      room.gameState.resultText =
        role === 'w' ? 'انسحب الأبيض — الأسود فاز' : 'انسحب الأسود — الأبيض فاز';
      room.status = 'finished';
      room.drawOfferBy = null;
      room.lastActivityAt = Date.now();

      addSystemChat(room, room.gameState.resultText);
      broadcastRoom(room, { type: 'room:state', snapshot: toSnapshot(room) });
      return;
    }

    case 'game:offerDraw': {
      const room = rooms.get(msg.code);
      if (!room || room.status !== 'playing' || room.gameState.over) return;
      const role = getRoleInRoom(room, msg.playerToken);
      if (role !== 'w' && role !== 'b') return;
      if (room.drawOfferBy === role) return;

      room.drawOfferBy = role;
      room.lastActivityAt = Date.now();
      const name = role === 'w' ? room.players.w?.name : room.players.b?.name;
      addSystemChat(room, `عرض ${name || 'اللاعب'} التعادل`);
      broadcastRoom(room, { type: 'room:state', snapshot: toSnapshot(room) });
      return;
    }

    case 'game:respondDraw': {
      const room = rooms.get(msg.code);
      if (!room || room.status !== 'playing' || room.gameState.over) return;
      const role = getRoleInRoom(room, msg.playerToken);
      if (role !== 'w' && role !== 'b') return;
      if (!room.drawOfferBy || room.drawOfferBy === role) return;

      if (msg.accept) {
        room.gameState.over = true;
        room.gameState.winner = 'draw';
        room.gameState.resultText = 'تعادل بالاتفاق بين اللاعبين';
        room.status = 'finished';
        room.drawOfferBy = null;
        addSystemChat(room, 'تم قبول التعادل');
      } else {
        room.drawOfferBy = null;
        addSystemChat(room, 'تم رفض عرض التعادل');
      }
      room.lastActivityAt = Date.now();
      broadcastRoom(room, { type: 'room:state', snapshot: toSnapshot(room) });
      return;
    }

    case 'game:rematch': {
      const room = rooms.get(msg.code);
      if (!room || room.status !== 'finished') return;
      const role = getRoleInRoom(room, msg.playerToken);
      if (role !== 'w' && role !== 'b') return;

      room.rematchVotes[role] = true;
      room.lastActivityAt = Date.now();

      if (room.rematchVotes.w && room.rematchVotes.b) {
        // Swap colors for fairness
        const oldW = room.players.w;
        const oldB = room.players.b;
        room.players.w = oldB;
        room.players.b = oldW;
        room.gameState = createInitialState(room.timeMinutes);
        room.status = 'playing';
        room.drawOfferBy = null;
        room.rematchVotes = { w: false, b: false };
        room.lastTickAt = Date.now();

        addSystemChat(room, 'بدأت جولة جديدة مع تبديل الألوان!');
        const snap = toSnapshot(room);
        if (room.players.w?.ws) {
          sendJson(room.players.w.ws, {
            type: 'room:joined',
            role: 'w',
            snapshot: snap,
          });
        }
        if (room.players.b?.ws) {
          sendJson(room.players.b.ws, {
            type: 'room:joined',
            role: 'b',
            snapshot: snap,
          });
        }
        for (const specWs of room.spectators.values()) {
          sendJson(specWs, {
            type: 'room:joined',
            role: 'spectator',
            snapshot: snap,
          });
        }
      } else {
        const name = role === 'w' ? room.players.w?.name : room.players.b?.name;
        addSystemChat(room, `طلب ${name || 'اللاعب'} إعادة المباراة`);
        broadcastRoom(room, { type: 'room:state', snapshot: toSnapshot(room) });
      }
      return;
    }

    case 'game:chat': {
      const room = rooms.get(msg.code);
      if (!room) return;
      const clean = String(msg.text || '').trim().slice(0, 280);
      if (!clean) return;

      const role = getRoleInRoom(room, msg.playerToken);
      const senderName =
        role === 'w'
          ? room.players.w?.name || 'الأبيض'
          : role === 'b'
            ? room.players.b?.name || 'الأسود'
            : 'مشاهد';

      const chatMsg: ChatMessage = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        senderName,
        senderRole: role,
        text: clean,
        timestamp: Date.now(),
      };
      room.chat.push(chatMsg);
      if (room.chat.length > 60) room.chat.shift();
      room.lastActivityAt = Date.now();
      broadcastRoom(room, { type: 'room:chat', message: chatMsg });
      return;
    }
  }
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      onlineUsers: clients.size,
      activeRooms: rooms.size,
      queueSize: matchmakingQueue.length,
    });
  });

  const server = createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    clients.set(ws, {
      ws,
      playerToken: null,
      roomCode: null,
      inLobby: false,
    });

    ws.on('message', (data) => {
      handleMessage(ws, data.toString());
    });

    ws.on('close', () => {
      const meta = clients.get(ws);
      removeFromQueue(ws);
      if (meta) {
        detachFromRoom(meta);
        clients.delete(ws);
      }
      broadcastLobby();
    });

    ws.on('error', () => {
      removeFromQueue(ws);
    });
  });

  // Authoritative 1-second clock & room cleanup loop
  setInterval(() => {
    const now = Date.now();
    for (const [code, room] of rooms.entries()) {
      if (room.status === 'playing' && room.timeMinutes > 0 && room.gameState.started) {
        const ended = tickRoomClock(room);
        if (!ended) {
          broadcastRoom(room, {
            type: 'room:clock',
            clocks: { ...room.gameState.clocks },
            lastSyncAt: now,
          });
        }
      }

      const anyConnected =
        room.players.w?.connected ||
        room.players.b?.connected ||
        room.spectators.size > 0;
      if (!anyConnected && now - room.lastActivityAt > 15 * 60 * 1000) {
        rooms.delete(code);
      }
    }
  }, 1000);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Mahmoud Chess server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
