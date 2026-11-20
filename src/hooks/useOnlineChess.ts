import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isInCheck,
  type PieceChar,
  type PieceColor,
} from '../shared/chessEngine.ts';
import type {
  ClientMessage,
  OnlineRoomSnapshot,
  RoomSummary,
  ServerMessage,
} from '../shared/protocol.ts';
import type { SoundKind } from './useChessSound.ts';

function getOrCreatePlayerToken(): string {
  try {
    const existing = localStorage.getItem('mahmoud_chess_token');
    if (existing) return existing;
    const created =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `mc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem('mahmoud_chess_token', created);
    return created;
  } catch {
    return `mc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export interface UseOnlineChessOptions {
  enabled: boolean;
  isOnline: boolean;
  onSound: (kind: SoundKind) => void;
}

export function useOnlineChess({
  enabled,
  isOnline,
  onSound,
}: UseOnlineChessOptions) {
  const [playerToken] = useState<string>(() => getOrCreatePlayerToken());
  const [playerName, setPlayerNameState] = useState<string>(() => {
    try {
      return localStorage.getItem('mahmoud_chess_name') || 'لاعب';
    } catch {
      return 'لاعب';
    }
  });

  const [wsStatus, setWsStatus] = useState<
    'disconnected' | 'connecting' | 'connected'
  >('disconnected');
  const [onlineCount, setOnlineCount] = useState(0);
  const [queueCount, setQueueCount] = useState(0);
  const [openRooms, setOpenRooms] = useState<RoomSummary[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchingTime, setSearchingTime] = useState<number>(10);
  const [room, setRoom] = useState<OnlineRoomSnapshot | null>(null);
  const [myRole, setMyRole] = useState<PieceColor | 'spectator' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const activeRoomCodeRef = useRef<string | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const heartbeatRef = useRef<number | null>(null);
  const prevHistoryLenRef = useRef<number>(0);
  const playerNameRef = useRef<string>(playerName);
  const onSoundRef = useRef(onSound);
  onSoundRef.current = onSound;

  const setPlayerName = useCallback((name: string) => {
    setPlayerNameState(name);
    playerNameRef.current = name;
    try {
      localStorage.setItem('mahmoud_chess_name', name);
    } catch {
      // Ignore storage error
    }
  }, []);

  const send = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }, []);

  // Keep active room code ref synced
  useEffect(() => {
    activeRoomCodeRef.current = room?.code || null;
  }, [room?.code]);

  // Connect & maintain WebSocket lifecycle
  useEffect(() => {
    if (!enabled || !isOnline) {
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (heartbeatRef.current) {
        window.clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setWsStatus('disconnected');
      return;
    }

    let cancelled = false;
    let retryAttempt = 0;

    const connect = () => {
      if (cancelled) return;
      setWsStatus('connecting');
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${proto}//${window.location.host}/ws`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) {
          ws.close();
          return;
        }
        retryAttempt = 0;
        setWsStatus('connected');
        setErrorMsg(null);

        ws.send(JSON.stringify({ type: 'lobby:subscribe' } satisfies ClientMessage));

        const targetCode = activeRoomCodeRef.current;
        if (targetCode) {
          ws.send(
            JSON.stringify({
              type: 'room:join',
              code: targetCode,
              playerName: playerNameRef.current,
              playerToken,
            } satisfies ClientMessage)
          );
        }

        if (heartbeatRef.current) window.clearInterval(heartbeatRef.current);
        heartbeatRef.current = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' } satisfies ClientMessage));
          }
        }, 25000);
      };

      ws.onmessage = (event) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(event.data as string) as ServerMessage;
        } catch {
          return;
        }

        switch (msg.type) {
          case 'lobby:update': {
            setOnlineCount(msg.onlineCount);
            setQueueCount(msg.queueCount);
            setOpenRooms(msg.openRooms);
            break;
          }
          case 'matchmaking:waiting': {
            setIsSearching(true);
            setSearchingTime(msg.timeMinutes);
            setErrorMsg(null);
            break;
          }
          case 'matchmaking:cancelled': {
            setIsSearching(false);
            break;
          }
          case 'room:joined': {
            setIsSearching(false);
            setMyRole(msg.role);
            setRoom(msg.snapshot);
            prevHistoryLenRef.current = msg.snapshot.gameState.history.length;
            setErrorMsg(null);
            break;
          }
          case 'room:state': {
            const nextLen = msg.snapshot.gameState.history.length;
            if (nextLen > prevHistoryLenRef.current) {
              const lastMove = msg.snapshot.gameState.history[nextLen - 1];
              if (msg.snapshot.gameState.over) {
                onSoundRef.current('end');
              } else if (
                isInCheck(
                  msg.snapshot.gameState.b,
                  msg.snapshot.gameState.turn
                )
              ) {
                onSoundRef.current('check');
              } else {
                onSoundRef.current(lastMove?.capture ? 'capture' : 'move');
              }
            } else if (msg.snapshot.gameState.over) {
              onSoundRef.current('end');
            }
            prevHistoryLenRef.current = nextLen;
            setRoom(msg.snapshot);
            break;
          }
          case 'room:chat': {
            setRoom((prev) =>
              prev
                ? {
                    ...prev,
                    chat: prev.chat.some((c) => c.id === msg.message.id)
                      ? prev.chat
                      : [...prev.chat, msg.message].slice(-60),
                  }
                : prev
            );
            break;
          }
          case 'room:clock': {
            setRoom((prev) =>
              prev
                ? {
                    ...prev,
                    lastSyncAt: msg.lastSyncAt,
                    gameState: {
                      ...prev.gameState,
                      clocks: msg.clocks,
                    },
                  }
                : prev
            );
            break;
          }
          case 'error': {
            setErrorMsg(msg.message);
            break;
          }
        }
      };

      ws.onclose = () => {
        if (heartbeatRef.current) {
          window.clearInterval(heartbeatRef.current);
          heartbeatRef.current = null;
        }
        if (cancelled) return;
        setWsStatus('disconnected');
        const delay = Math.min(5000, 1200 * Math.pow(1.5, retryAttempt));
        retryAttempt++;
        reconnectTimerRef.current = window.setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (heartbeatRef.current) {
        window.clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [enabled, isOnline, playerToken]);

  // Smooth local 250ms clock interpolation while waiting for 1s server sync
  useEffect(() => {
    if (
      !room ||
      room.status !== 'playing' ||
      room.timeMinutes === 0 ||
      !room.gameState.started ||
      room.gameState.over
    ) {
      return;
    }

    let last = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      const dt = (now - last) / 1000;
      last = now;
      setRoom((prev) => {
        if (
          !prev ||
          prev.status !== 'playing' ||
          !prev.gameState.started ||
          prev.gameState.over
        ) {
          return prev;
        }
        const turn = prev.gameState.turn;
        return {
          ...prev,
          gameState: {
            ...prev.gameState,
            clocks: {
              ...prev.gameState.clocks,
              [turn]: Math.max(0, prev.gameState.clocks[turn] - dt),
            },
          },
        };
      });
    }, 250);

    return () => window.clearInterval(id);
  }, [
    room?.code,
    room?.status,
    room?.timeMinutes,
    room?.gameState.started,
    room?.gameState.over,
    room?.gameState.turn,
  ]);

  const joinMatchmaking = useCallback(
    (timeMinutes: number) => {
      setErrorMsg(null);
      send({
        type: 'matchmaking:join',
        playerName: playerNameRef.current,
        timeMinutes,
        playerToken,
      });
    },
    [playerToken, send]
  );

  const leaveMatchmaking = useCallback(() => {
    send({ type: 'matchmaking:leave' });
    setIsSearching(false);
  }, [send]);

  const createRoom = useCallback(
    (
      timeMinutes: number,
      preferredColor: 'random' | PieceColor,
      isPublic: boolean
    ) => {
      setErrorMsg(null);
      send({
        type: 'room:create',
        playerName: playerNameRef.current,
        timeMinutes,
        preferredColor,
        isPublic,
        playerToken,
      });
    },
    [playerToken, send]
  );

  const joinRoom = useCallback(
    (code: string) => {
      const clean = code.trim().toUpperCase();
      if (!clean) return;
      setErrorMsg(null);
      activeRoomCodeRef.current = clean;
      send({
        type: 'room:join',
        code: clean,
        playerName: playerNameRef.current,
        playerToken,
      });
    },
    [playerToken, send]
  );

  const leaveRoom = useCallback(() => {
    send({ type: 'room:leave' });
    activeRoomCodeRef.current = null;
    setRoom(null);
    setMyRole(null);
    const url = new URL(window.location.href);
    if (url.searchParams.has('room')) {
      url.searchParams.delete('room');
      window.history.replaceState({}, '', url.toString());
    }
  }, [send]);

  const sendMove = useCallback(
    (from: string, to: string, promotion?: PieceChar | null) => {
      if (!room) return;
      send({
        type: 'game:move',
        code: room.code,
        from,
        to,
        promotion: promotion || null,
        playerToken,
      });
    },
    [playerToken, room, send]
  );

  const resign = useCallback(() => {
    if (!room) return;
    send({ type: 'game:resign', code: room.code, playerToken });
  }, [playerToken, room, send]);

  const offerDraw = useCallback(() => {
    if (!room) return;
    send({ type: 'game:offerDraw', code: room.code, playerToken });
  }, [playerToken, room, send]);

  const respondDraw = useCallback(
    (accept: boolean) => {
      if (!room) return;
      send({ type: 'game:respondDraw', code: room.code, accept, playerToken });
    },
    [playerToken, room, send]
  );

  const requestRematch = useCallback(() => {
    if (!room) return;
    send({ type: 'game:rematch', code: room.code, playerToken });
  }, [playerToken, room, send]);

  const sendChat = useCallback(
    (text: string) => {
      if (!room || !text.trim()) return;
      send({ type: 'game:chat', code: room.code, text, playerToken });
    },
    [playerToken, room, send]
  );

  return {
    playerToken,
    playerName,
    setPlayerName,
    wsStatus,
    onlineCount,
    queueCount,
    openRooms,
    isSearching,
    searchingTime,
    room,
    myRole,
    errorMsg,
    clearError: () => setErrorMsg(null),
    joinMatchmaking,
    leaveMatchmaking,
    createRoom,
    joinRoom,
    leaveRoom,
    sendMove,
    resign,
    offerDraw,
    respondDraw,
    requestRematch,
    sendChat,
  };
}
