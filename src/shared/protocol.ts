import type { GameState, PieceChar, PieceColor } from './chessEngine.ts';

export type TimeControlMinutes = 0 | 3 | 5 | 10 | 15;

export interface PlayerInfo {
  name: string;
  connected: boolean;
}

export interface ChatMessage {
  id: string;
  senderName: string;
  senderRole: PieceColor | 'spectator' | 'system';
  text: string;
  timestamp: number;
}

export interface RoomSummary {
  code: string;
  hostName: string;
  timeMinutes: number;
  playersCount: number;
  createdAt: number;
  status: 'waiting' | 'playing' | 'finished';
}

export interface OnlineRoomSnapshot {
  code: string;
  status: 'waiting' | 'playing' | 'finished';
  timeMinutes: number;
  players: {
    w: PlayerInfo | null;
    b: PlayerInfo | null;
  };
  spectatorsCount: number;
  drawOfferBy: PieceColor | null;
  rematchVotes: { w: boolean; b: boolean };
  gameState: GameState;
  chat: ChatMessage[];
  lastSyncAt: number;
}

export type ClientMessage =
  | { type: 'lobby:subscribe' }
  | { type: 'lobby:unsubscribe' }
  | {
      type: 'matchmaking:join';
      playerName: string;
      timeMinutes: number;
      playerToken: string;
    }
  | { type: 'matchmaking:leave' }
  | {
      type: 'room:create';
      playerName: string;
      timeMinutes: number;
      preferredColor: 'random' | PieceColor;
      isPublic: boolean;
      playerToken: string;
    }
  | {
      type: 'room:join';
      code: string;
      playerName: string;
      playerToken: string;
    }
  | { type: 'room:leave' }
  | {
      type: 'game:move';
      code: string;
      from: string;
      to: string;
      promotion?: PieceChar | null;
      playerToken: string;
    }
  | { type: 'game:resign'; code: string; playerToken: string }
  | { type: 'game:offerDraw'; code: string; playerToken: string }
  | {
      type: 'game:respondDraw';
      code: string;
      accept: boolean;
      playerToken: string;
    }
  | { type: 'game:rematch'; code: string; playerToken: string }
  | {
      type: 'game:chat';
      code: string;
      text: string;
      playerToken: string;
    }
  | { type: 'ping' };

export type ServerMessage =
  | {
      type: 'lobby:update';
      onlineCount: number;
      queueCount: number;
      openRooms: RoomSummary[];
    }
  | { type: 'matchmaking:waiting'; timeMinutes: number }
  | { type: 'matchmaking:cancelled' }
  | {
      type: 'room:joined';
      role: PieceColor | 'spectator';
      snapshot: OnlineRoomSnapshot;
    }
  | { type: 'room:state'; snapshot: OnlineRoomSnapshot }
  | { type: 'room:chat'; message: ChatMessage }
  | {
      type: 'room:clock';
      clocks: { w: number; b: number };
      lastSyncAt: number;
    }
  | { type: 'error'; message: string }
  | { type: 'pong' };
