export type PieceColor = 'w' | 'b';
export type PieceChar =
  | 'K'
  | 'Q'
  | 'R'
  | 'B'
  | 'N'
  | 'P'
  | 'k'
  | 'q'
  | 'r'
  | 'b'
  | 'n'
  | 'p';

export type BoardGrid = (PieceChar | null)[][];
export type SquareCoord = [number, number];

export interface Move {
  from: SquareCoord;
  to: SquareCoord;
  piece: PieceChar;
  capture?: PieceChar | null;
  promotion?: PieceChar;
  promoted?: boolean;
  double?: boolean;
  ep?: boolean;
  castle?: 'K' | 'Q';
}

export interface Snapshot {
  fen: string;
  captured: { w: PieceChar[]; b: PieceChar[] };
  clocks: { w: number; b: number };
  started: boolean;
  over: boolean;
  repetition: string[];
}

export interface HistoryEntry {
  before?: Snapshot;
  from: string;
  to: string;
  piece: PieceChar;
  capture: PieceChar | null;
  promotion: PieceChar | null;
  san?: string;
}

export interface GameState {
  b: BoardGrid;
  turn: PieceColor;
  rights: string;
  ep: SquareCoord | null;
  half: number;
  full: number;
  history: HistoryEntry[];
  captured: { w: PieceChar[]; b: PieceChar[] };
  repetition: string[];
  over: boolean;
  resultText: string | null;
  winner: PieceColor | 'draw' | null;
  clocks: { w: number; b: number };
  initialTime: number;
  started: boolean;
}

export interface PositionState {
  b: BoardGrid;
  rights: string;
  ep: SquareCoord | null;
}

export const START_FEN =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const PIECE_SYMBOLS: Record<PieceChar, string> = {
  K: '♔',
  Q: '♕',
  R: '♖',
  B: '♗',
  N: '♘',
  P: '♙',
  k: '♚',
  q: '♛',
  r: '♜',
  b: '♝',
  n: '♞',
  p: '♟',
};

export const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 335,
  r: 500,
  q: 900,
  k: 20000,
};

export function cloneBoard(b: BoardGrid): BoardGrid {
  return b.map((row) => row.slice());
}

export function cloneValue<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

export function pieceColor(p: PieceChar | null | undefined): PieceColor | null {
  if (!p) return null;
  return p === p.toUpperCase() ? 'w' : 'b';
}

export function inside(r: number, c: number): boolean {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

export function sqName(pos: SquareCoord): string {
  return 'abcdefgh'[pos[1]] + (8 - pos[0]);
}

export function nameSq(n: string): SquareCoord {
  return [8 - Number(n[1]), n.charCodeAt(0) - 97];
}

export function parseBoard(f: string): BoardGrid {
  const rows = f.split(' ')[0].split('/');
  if (rows.length !== 8) {
    throw new Error('Invalid FEN rows');
  }

  return rows.map((row) => {
    const a: (PieceChar | null)[] = [];
    for (const ch of row) {
      if (/[1-8]/.test(ch)) {
        for (let i = 0; i < Number(ch); i++) a.push(null);
      } else if ('KQRBNPkqrbnp'.includes(ch)) {
        a.push(ch as PieceChar);
      } else {
        throw new Error('Invalid piece');
      }
    }
    if (a.length !== 8) {
      throw new Error('Invalid row length');
    }
    return a;
  });
}

export function parseFenIntoState(f: string, target: GameState): void {
  const p = f.trim().split(/\s+/);
  if (p.length !== 6) throw new Error('Invalid FEN');

  const board = parseBoard(p[0]);
  const whiteKings = board.flat().filter((piece) => piece === 'K').length;
  const blackKings = board.flat().filter((piece) => piece === 'k').length;
  if (whiteKings !== 1 || blackKings !== 1) {
    throw new Error('Invalid king count');
  }
  for (let c = 0; c < 8; c++) {
    if (
      board[0][c]?.toLowerCase() === 'p' ||
      board[7][c]?.toLowerCase() === 'p'
    ) {
      throw new Error('Invalid pawn position');
    }
  }

  if (p[1] !== 'w' && p[1] !== 'b') throw new Error('Invalid turn');
  if (p[2] !== '-' && !/^(?!.*(.).*\1)[KQkq]+$/.test(p[2])) {
    throw new Error('Invalid castling');
  }

  let ep: SquareCoord | null = null;
  if (p[3] !== '-') {
    if (!/^[a-h][36]$/.test(p[3])) throw new Error('Invalid en passant');
    ep = nameSq(p[3]);
  }

  const half = Number(p[4]);
  const full = Number(p[5]);
  if (!Number.isInteger(half) || half < 0 || !Number.isInteger(full) || full < 1) {
    throw new Error('Invalid counters');
  }

  target.b = board;
  target.turn = p[1];
  target.rights = p[2] === '-' ? '' : p[2];
  target.ep = ep;
  target.half = half;
  target.full = full;
}

export function toFen(s: Pick<GameState, 'b' | 'turn' | 'rights' | 'ep' | 'half' | 'full'>): string {
  const rows = s.b
    .map((row) => {
      let out = '';
      let n = 0;
      for (const p of row) {
        if (!p) {
          n++;
        } else {
          if (n) {
            out += n;
            n = 0;
          }
          out += p;
        }
      }
      if (n) out += n;
      return out;
    })
    .join('/');

  return `${rows} ${s.turn} ${s.rights || '-'} ${
    s.ep === null ? '-' : sqName(s.ep)
  } ${s.half} ${s.full}`;
}

export function repetitionKey(s: Pick<GameState, 'b' | 'turn' | 'rights' | 'ep' | 'half' | 'full'>): string {
  const parts = toFen(s).split(' ');
  const canEnPassant =
    s.ep !== null &&
    legalMovesFor(s.b, s.turn, s.rights, s.ep).some((move) => move.ep);
  const ep = canEnPassant && s.ep ? sqName(s.ep) : '-';
  return [parts[0], parts[1], parts[2], ep].join(' ');
}

export function createInitialState(initialMinutes = 10): GameState {
  const state: GameState = {
    b: parseBoard(START_FEN),
    turn: 'w',
    rights: 'KQkq',
    ep: null,
    half: 0,
    full: 1,
    history: [],
    captured: { w: [], b: [] },
    repetition: [],
    over: false,
    resultText: null,
    winner: null,
    clocks: { w: initialMinutes * 60, b: initialMinutes * 60 },
    initialTime: initialMinutes,
    started: false,
  };
  state.repetition = [repetitionKey(state)];
  return state;
}

export function createSnapshot(s: GameState): Snapshot {
  return {
    fen: toFen(s),
    captured: cloneValue(s.captured),
    clocks: cloneValue(s.clocks),
    started: s.started,
    over: s.over,
    repetition: cloneValue(s.repetition),
  };
}

export function isAttacked(b: BoardGrid, r: number, c: number, by: PieceColor): boolean {
  const pawnDir = by === 'w' ? 1 : -1;
  const pawnRow = r + pawnDir;

  for (const dc of [-1, 1]) {
    if (inside(pawnRow, c + dc) && b[pawnRow][c + dc] === (by === 'w' ? 'P' : 'p')) {
      return true;
    }
  }

  const knights: [number, number][] = [
    [-2, -1],
    [-2, 1],
    [-1, -2],
    [-1, 2],
    [1, -2],
    [1, 2],
    [2, -1],
    [2, 1],
  ];

  for (const [dr, dc] of knights) {
    const rr = r + dr;
    const cc = c + dc;
    if (inside(rr, cc) && b[rr][cc] === (by === 'w' ? 'N' : 'n')) {
      return true;
    }
  }

  const dirs: [number, number][] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];

  for (const [dr, dc] of dirs) {
    let rr = r + dr;
    let cc = c + dc;
    let dist = 1;

    while (inside(rr, cc)) {
      const p = b[rr][cc];
      if (p) {
        if (pieceColor(p) === by) {
          const t = p.toLowerCase();
          if (
            t === 'q' ||
            (dist === 1 && t === 'k') ||
            ((dr === 0 || dc === 0) && t === 'r') ||
            ((dr !== 0 && dc !== 0) && t === 'b')
          ) {
            return true;
          }
        }
        break;
      }
      rr += dr;
      cc += dc;
      dist++;
    }
  }

  return false;
}

export function findKing(b: BoardGrid, col: PieceColor): SquareCoord | null {
  const target = col === 'w' ? 'K' : 'k';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (b[r][c] === target) return [r, c];
    }
  }
  return null;
}

export function isInCheck(b: BoardGrid, col: PieceColor): boolean {
  const k = findKing(b, col);
  return !k || isAttacked(b, k[0], k[1], col === 'w' ? 'b' : 'w');
}

export function pseudoLegalMoves(
  b: BoardGrid,
  r: number,
  c: number,
  rights: string,
  ep: SquareCoord | null
): Move[] {
  const p = b[r][c];
  const col = pieceColor(p);
  const t = p?.toLowerCase();
  const out: Move[] = [];

  if (!p || !col || !t) return out;

  const add = (rr: number, cc: number, extra: Partial<Move> = {}) => {
    if (!inside(rr, cc)) return;
    const target = b[rr][cc];
    if (target && target.toLowerCase() === 'k') return;
    if (pieceColor(target) !== col) {
      out.push({
        from: [r, c],
        to: [rr, cc],
        piece: p,
        capture: target || null,
        ...extra,
      });
    }
  };

  if (t === 'p') {
    const d = col === 'w' ? -1 : 1;
    const start = col === 'w' ? 6 : 1;
    const last = col === 'w' ? 0 : 7;
    const rr = r + d;

    if (inside(rr, c) && !b[rr][c]) {
      if (rr === last) {
        const promos = col === 'w' ? 'QRBN' : 'qrbn';
        for (const pr of promos) {
          add(rr, c, { promotion: pr as PieceChar });
        }
      } else {
        add(rr, c);
      }

      if (r === start && !b[r + 2 * d][c]) {
        add(r + 2 * d, c, { double: true });
      }
    }

    for (const dc of [-1, 1]) {
      const cc = c + dc;
      if (!inside(rr, cc)) continue;

      if (pieceColor(b[rr][cc]) === (col === 'w' ? 'b' : 'w')) {
        if (rr === last) {
          const promos = col === 'w' ? 'QRBN' : 'qrbn';
          for (const pr of promos) {
            add(rr, cc, { promotion: pr as PieceChar });
          }
        } else {
          add(rr, cc);
        }
      }

      if (ep && ep[0] === rr && ep[1] === cc && !b[rr][cc]) {
        add(rr, cc, {
          ep: true,
          capture: col === 'w' ? 'p' : 'P',
        });
      }
    }
  } else if (t === 'n') {
    const dirs: [number, number][] = [
      [-2, -1],
      [-2, 1],
      [-1, -2],
      [-1, 2],
      [1, -2],
      [1, 2],
      [2, -1],
      [2, 1],
    ];
    for (const [dr, dc] of dirs) {
      add(r + dr, c + dc);
    }
  } else if (t === 'k') {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr || dc) add(r + dr, c + dc);
      }
    }

    const home = col === 'w' ? 7 : 0;
    const enemy: PieceColor = col === 'w' ? 'b' : 'w';
    const R: PieceChar = col === 'w' ? 'R' : 'r';
    const ks = col === 'w' ? 'K' : 'k';
    const qs = col === 'w' ? 'Q' : 'q';

    if (r === home && c === 4 && !isInCheck(b, col)) {
      if (
        rights.includes(ks) &&
        b[home][7] === R &&
        !b[home][5] &&
        !b[home][6] &&
        !isAttacked(b, home, 5, enemy) &&
        !isAttacked(b, home, 6, enemy)
      ) {
        out.push({
          from: [r, c],
          to: [home, 6],
          piece: p,
          castle: 'K',
        });
      }

      if (
        rights.includes(qs) &&
        b[home][0] === R &&
        !b[home][1] &&
        !b[home][2] &&
        !b[home][3] &&
        !isAttacked(b, home, 3, enemy) &&
        !isAttacked(b, home, 2, enemy)
      ) {
        out.push({
          from: [r, c],
          to: [home, 2],
          piece: p,
          castle: 'Q',
        });
      }
    }
  } else {
    const dirs: [number, number][] = [];
    if (t === 'r' || t === 'q') dirs.push([1, 0], [-1, 0], [0, 1], [0, -1]);
    if (t === 'b' || t === 'q') dirs.push([1, 1], [1, -1], [-1, 1], [-1, -1]);

    for (const [dr, dc] of dirs) {
      let rr = r + dr;
      let cc = c + dc;
      while (inside(rr, cc)) {
        if (!b[rr][cc]) {
          out.push({
            from: [r, c],
            to: [rr, cc],
            piece: p,
          });
        } else {
          if (pieceColor(b[rr][cc]) !== col) add(rr, cc);
          break;
        }
        rr += dr;
        cc += dc;
      }
    }
  }

  return out;
}

export function applyMoveToPosition(
  pos: { b: BoardGrid; turn: PieceColor; rights: string },
  m: Move
): PositionState {
  const b = cloneBoard(pos.b);
  let rights = pos.rights;
  let ep: SquareCoord | null = null;

  const [r, c] = m.from;
  const [rr, cc] = m.to;
  const p = b[r][c];
  const target = b[rr][cc];

  b[r][c] = null;

  if (m.ep) {
    // Remove the captured pawn behind the target square
    b[r][cc] = null;
  }

  if (m.castle) {
    if (m.castle === 'K') {
      b[rr][5] = b[rr][7];
      b[rr][7] = null;
    } else {
      b[rr][3] = b[rr][0];
      b[rr][0] = null;
    }
  }

  b[rr][cc] = m.promotion || p;

  if (p && p.toLowerCase() === 'k') {
    rights = rights.replace(pos.turn === 'w' ? /K|Q/g : /k|q/g, '');
  }

  if (p && p.toLowerCase() === 'r') {
    if (r === 7 && c === 0) rights = rights.replace('Q', '');
    if (r === 7 && c === 7) rights = rights.replace('K', '');
    if (r === 0 && c === 0) rights = rights.replace('q', '');
    if (r === 0 && c === 7) rights = rights.replace('k', '');
  }

  if (target?.toLowerCase() === 'r') {
    if (rr === 7 && cc === 0) rights = rights.replace('Q', '');
    if (rr === 7 && cc === 7) rights = rights.replace('K', '');
    if (rr === 0 && cc === 0) rights = rights.replace('q', '');
    if (rr === 0 && cc === 7) rights = rights.replace('k', '');
  }

  if (m.double) {
    ep = [(r + rr) / 2, c];
  }

  return { b, rights, ep };
}

export function legalMovesFor(
  b: BoardGrid,
  col: PieceColor,
  rights: string,
  ep: SquareCoord | null
): Move[] {
  const out: Move[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (pieceColor(b[r][c]) !== col) continue;
      const moves = pseudoLegalMoves(b, r, c, rights, ep);
      for (const m of moves) {
        const next = applyMoveToPosition({ b, turn: col, rights }, m);
        if (!isInCheck(next.b, col)) {
          out.push(m);
        }
      }
    }
  }
  return out;
}

export function isInsufficientMaterial(b: BoardGrid): boolean {
  const pieces: { type: string; square: number }[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = b[r][c];
      if (p && p.toLowerCase() !== 'k') {
        pieces.push({
          type: p.toLowerCase(),
          square: (r + c) % 2,
        });
      }
    }
  }

  if (pieces.length === 0) return true;
  if (pieces.length === 1 && ['b', 'n'].includes(pieces[0].type)) return true;
  if (pieces.every((p) => p.type === 'b')) {
    const colors = new Set(pieces.map((p) => p.square));
    if (colors.size === 1) return true;
  }
  return false;
}

export function sameMove(a: Move | null | undefined, b: Move | null | undefined): boolean {
  if (!a || !b) return false;
  return (
    a.from[0] === b.from[0] &&
    a.from[1] === b.from[1] &&
    a.to[0] === b.to[0] &&
    a.to[1] === b.to[1] &&
    a.promotion === b.promotion &&
    a.castle === b.castle &&
    !!a.ep === !!b.ep
  );
}

export function findMatchingLegalMove(
  s: Pick<GameState, 'b' | 'turn' | 'rights' | 'ep'>,
  fromSq: string,
  toSq: string,
  promotion?: PieceChar | null
): Move | null {
  const from = nameSq(fromSq);
  const to = nameSq(toSq);
  const moves = legalMovesFor(s.b, s.turn, s.rights, s.ep);
  return (
    moves.find(
      (m) =>
        m.from[0] === from[0] &&
        m.from[1] === from[1] &&
        m.to[0] === to[0] &&
        m.to[1] === to[1] &&
        (!m.promotion || m.promotion === promotion)
    ) || null
  );
}

export function executeMoveOnState(
  prev: GameState,
  m: Move,
  includeSnapshot = true
): { nextState: GameState; entry: HistoryEntry } {
  const s: GameState = cloneValue(prev);
  const p = s.b[m.from[0]][m.from[1]];
  if (!p) throw new Error('No piece at source square');

  const captured: PieceChar | null = m.ep
    ? s.turn === 'w'
      ? 'p'
      : 'P'
    : s.b[m.to[0]][m.to[1]];

  const before = includeSnapshot ? createSnapshot(prev) : undefined;

  const entry: HistoryEntry = {
    before,
    from: sqName(m.from),
    to: sqName(m.to),
    piece: p,
    capture: captured,
    promotion: m.promotion || null,
  };

  s.history.push(entry);

  const n = applyMoveToPosition(s, m);
  s.b = n.b;
  s.rights = n.rights;
  s.ep = n.ep;

  s.half = p.toLowerCase() === 'p' || captured ? 0 : s.half + 1;
  if (s.turn === 'b') s.full++;
  if (captured) {
    s.captured[s.turn].push(captured);
  }

  s.turn = s.turn === 'w' ? 'b' : 'w';
  s.started = true;

  const repKey = repetitionKey(s);
  s.repetition.push(repKey);

  // Evaluate end-of-game status
  const legal = legalMovesFor(s.b, s.turn, s.rights, s.ep);
  if (!legal.length) {
    s.over = true;
    if (isInCheck(s.b, s.turn)) {
      s.winner = s.turn === 'w' ? 'b' : 'w';
      s.resultText =
        s.turn === 'w' ? 'كش مات — الأسود فاز' : 'كش مات — الأبيض فاز';
    } else {
      s.winner = 'draw';
      s.resultText = 'تعادل — حالة الجمود (Stalemate)';
    }
  } else if (s.half >= 150) {
    s.over = true;
    s.winner = 'draw';
    s.resultText = 'تعادل — قاعدة 75 نقلة';
  } else if (isInsufficientMaterial(s.b)) {
    s.over = true;
    s.winner = 'draw';
    s.resultText = 'تعادل — قطع غير كافية';
  } else if (s.repetition.filter((x) => x === repKey).length >= 5) {
    s.over = true;
    s.winner = 'draw';
    s.resultText = 'تعادل — تكرار الوضع خمس مرات';
  }

  return { nextState: s, entry };
}

export function getMaterialScore(captured: { w: PieceChar[]; b: PieceChar[] }): {
  wAdvantage: number;
  bAdvantage: number;
} {
  const sum = (list: PieceChar[]) =>
    list.reduce((acc, p) => acc + Math.round((PIECE_VALUES[p.toLowerCase()] || 0) / 100), 0);
  const wPoints = sum(captured.w);
  const bPoints = sum(captured.b);
  return {
    wAdvantage: Math.max(0, wPoints - bPoints),
    bAdvantage: Math.max(0, bPoints - wPoints),
  };
}

/* =================================
   محرك الذكاء الاصطناعي (Minimax + Alpha-Beta + Quiescence + TT)
================================= */

interface TTEntry {
  depth: number;
  score: number;
  flag: 'EXACT' | 'LOWER' | 'UPPER';
  move: Move | null;
}

export function evaluateBoard(b: BoardGrid): number {
  let score = 0;
  const bishops = { w: 0, b: 0 };

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = b[r][c];
      if (!p) continue;
      const col = pieceColor(p);
      const t = p.toLowerCase();
      const sign = col === 'w' ? 1 : -1;
      const center = 3.5 - (Math.abs(3.5 - r) + Math.abs(3.5 - c)) / 2;

      let bonus = 0;
      if (t === 'p') {
        bonus = col === 'w' ? (6 - r) * 9 : (r - 1) * 9;
        if (c === 3 || c === 4) bonus += 8;
      } else if (t === 'n') {
        bonus = center * 12;
      } else if (t === 'b') {
        bonus = center * 7;
        if (col) bishops[col]++;
      } else if (t === 'r') {
        bonus = center * 2;
      } else if (t === 'q') {
        bonus = center * 3;
      }

      score += sign * ((PIECE_VALUES[t] || 0) + bonus);
    }
  }

  if (bishops.w >= 2) score += 30;
  if (bishops.b >= 2) score -= 30;

  return score;
}

function moveOrderScore(m: Move): number {
  let score = 0;
  if (m.capture) {
    score +=
      10000 +
      (PIECE_VALUES[m.capture.toLowerCase()] || 0) * 10 -
      (PIECE_VALUES[m.piece.toLowerCase()] || 0);
  }
  if (m.promotion) {
    score += 9000 + (PIECE_VALUES[m.promotion.toLowerCase()] || 0);
  }
  if (m.castle) score += 100;
  return score;
}

function positionKey(pos: PositionState, maximizing: boolean): string {
  const rows = pos.b.map((r) => r.map((p) => p || '.').join('')).join('');
  return (
    rows +
    (maximizing ? 'w' : 'b') +
    (pos.rights || '-') +
    (pos.ep ? sqName(pos.ep) : '-')
  );
}

export function findBestAiMove(
  state: GameState,
  level: 1 | 2 | 3
): { move: Move | null; depth: number; nodes: number } {
  const moves = legalMovesFor(state.b, state.turn, state.rights, state.ep);
  if (!moves.length) return { move: null, depth: 0, nodes: 0 };

  if (level === 1) {
    const pick = moves[Math.floor(Math.random() * moves.length)];
    return { move: pick, depth: 1, nodes: moves.length };
  }

  const maximizing = state.turn === 'w';
  let searchNodes = 0;
  let searchStopped = false;
  const transTable = new Map<string, TTEntry>();

  const quiescence = (
    pos: PositionState,
    alpha: number,
    beta: number,
    isMax: boolean,
    ply = 0
  ): number => {
    searchNodes++;
    if (searchNodes > 70000) {
      searchStopped = true;
      return evaluateBoard(pos.b);
    }

    const col: PieceColor = isMax ? 'w' : 'b';
    const checked = isInCheck(pos.b, col);
    const stand = evaluateBoard(pos.b);

    if (ply >= 8) return stand;

    let qMoves = legalMovesFor(pos.b, col, pos.rights, pos.ep);
    if (!qMoves.length) {
      if (checked) return isMax ? -30000 + ply : 30000 - ply;
      return 0;
    }

    if (!checked) {
      if (isMax) {
        if (stand >= beta) return stand;
        alpha = Math.max(alpha, stand);
      } else {
        if (stand <= alpha) return stand;
        beta = Math.min(beta, stand);
      }
      qMoves = qMoves.filter((m) => m.capture || m.promotion);
    }

    if (!qMoves.length) return stand;

    qMoves.sort((a, b) => moveOrderScore(b) - moveOrderScore(a));
    let best = checked ? (isMax ? -Infinity : Infinity) : stand;

    for (const m of qMoves) {
      if (searchStopped) break;
      const n = applyMoveToPosition({ ...pos, turn: col }, m);
      const sc = quiescence(
        { b: n.b, rights: n.rights, ep: n.ep },
        alpha,
        beta,
        !isMax,
        ply + 1
      );
      if (isMax) {
        best = Math.max(best, sc);
        alpha = Math.max(alpha, best);
      } else {
        best = Math.min(best, sc);
        beta = Math.min(beta, best);
      }
      if (beta <= alpha) break;
    }

    return best;
  };

  const search = (
    pos: PositionState,
    depth: number,
    alpha: number,
    beta: number,
    isMax: boolean,
    ply = 0
  ): { score: number; move: Move | null } => {
    searchNodes++;
    if (searchNodes > 70000) {
      searchStopped = true;
      return { score: evaluateBoard(pos.b), move: null };
    }

    const col: PieceColor = isMax ? 'w' : 'b';
    const alphaOriginal = alpha;
    const betaOriginal = beta;
    const key = positionKey(pos, isMax);
    const cached = transTable.get(key);
    let preferred: Move | null = null;

    if (cached) {
      preferred = cached.move;
      if (cached.depth >= depth) {
        if (cached.flag === 'EXACT') {
          return { score: cached.score, move: cached.move };
        }
        if (cached.flag === 'LOWER') alpha = Math.max(alpha, cached.score);
        else if (cached.flag === 'UPPER') beta = Math.min(beta, cached.score);
        if (alpha >= beta) return { score: cached.score, move: cached.move };
      }
    }

    if (depth <= 0) {
      return { score: quiescence(pos, alpha, beta, isMax, ply), move: null };
    }

    const legal = legalMovesFor(pos.b, col, pos.rights, pos.ep);
    if (!legal.length) {
      return {
        score: isInCheck(pos.b, col) ? (isMax ? -30000 + ply : 30000 - ply) : 0,
        move: null,
      };
    }

    legal.sort((a, b) => {
      if (preferred) {
        const am = sameMove(a, preferred);
        const bm = sameMove(b, preferred);
        if (am !== bm) return am ? -1 : 1;
      }
      return moveOrderScore(b) - moveOrderScore(a);
    });

    let best: Move | null = null;
    let value = isMax ? -Infinity : Infinity;

    for (const move of legal) {
      if (searchStopped) break;
      const next = applyMoveToPosition({ ...pos, turn: col }, move);
      const result = search(
        { b: next.b, rights: next.rights, ep: next.ep },
        depth - 1,
        alpha,
        beta,
        !isMax,
        ply + 1
      );

      if (isMax) {
        if (result.score > value) {
          value = result.score;
          best = move;
        }
        alpha = Math.max(alpha, value);
      } else {
        if (result.score < value) {
          value = result.score;
          best = move;
        }
        beta = Math.min(beta, value);
      }
      if (beta <= alpha) break;
    }

    if (searchStopped) return { score: value, move: best };
    const flag =
      value <= alphaOriginal
        ? 'UPPER'
        : value >= betaOriginal
          ? 'LOWER'
          : 'EXACT';
    if (transTable.size > 120000) transTable.clear();
    transTable.set(key, { depth, score: value, flag, move: best });
    return { score: value, move: best };
  };

  const maxDepth = level === 2 ? 2 : 4;
  let bestResult: { score: number; move: Move | null; depth: number } | null = null;

  for (let depth = 1; depth <= maxDepth; depth++) {
    searchStopped = false;
    const result = search(
      { b: state.b, rights: state.rights, ep: state.ep },
      depth,
      -Infinity,
      Infinity,
      maximizing
    );
    if (searchStopped || !result.move) break;
    bestResult = { ...result, depth };
  }

  return {
    move: bestResult?.move || moves[0],
    depth: bestResult?.depth || 1,
    nodes: searchNodes,
  };
}

/* =================================
   تحليل نهاية المباراة وتقييم النقلات
================================= */

export type MoveQuality =
  | 'best'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder';

export interface CandidateMove {
  from: string;
  to: string;
  promotion: PieceChar | null;
  piece: PieceChar;
  scoreCp: number;
  mateIn: number | null;
  label: string;
}

export interface PositionAnalysis {
  scoreCp: number;
  mateIn: number | null;
  bestMove: CandidateMove | null;
  topMoves: CandidateMove[];
  depth: number;
}

export interface MoveAnalysisEntry {
  ply: number;
  mover: PieceColor;
  playedLabel: string;
  playedFrom: string;
  playedTo: string;
  scoreCp: number;
  mateIn: number | null;
  cpLoss: number;
  quality: MoveQuality;
  bestMoveBefore: CandidateMove | null;
  topMovesBefore: CandidateMove[];
}

export function extractMateIn(rawScore: number): number | null {
  if (Math.abs(rawScore) < 25000) return null;
  const pliesToMate = Math.max(1, 30000 - Math.abs(rawScore));
  const movesToMate = Math.max(1, Math.ceil(pliesToMate / 2));
  return rawScore > 0 ? movesToMate : -movesToMate;
}

export function formatEvalScore(
  scoreCp: number,
  mateIn: number | null
): string {
  if (mateIn !== null) {
    return mateIn > 0 ? `M${mateIn}` : `-M${Math.abs(mateIn)}`;
  }
  const pawns = scoreCp / 100;
  if (Math.abs(pawns) < 0.05) return '0.0';
  return pawns > 0 ? `+${pawns.toFixed(1)}` : pawns.toFixed(1);
}

export function formatMoveLabel(
  from: string,
  to: string,
  promotion?: PieceChar | null,
  capture?: PieceChar | null
): string {
  return `${from}-${to}${promotion ? '=' + promotion.toUpperCase() : ''}${
    capture ? '×' : ''
  }`;
}

export function analyzePosition(
  state: Pick<GameState, 'b' | 'turn' | 'rights' | 'ep'>,
  maxDepth = 2,
  maxNodes = 22000
): PositionAnalysis {
  const moves = legalMovesFor(state.b, state.turn, state.rights, state.ep);
  const checked = isInCheck(state.b, state.turn);

  if (!moves.length) {
    if (checked) {
      const mateScore = state.turn === 'w' ? -30000 : 30000;
      return {
        scoreCp: mateScore,
        mateIn: state.turn === 'w' ? -1 : 1,
        bestMove: null,
        topMoves: [],
        depth: 0,
      };
    }
    return {
      scoreCp: 0,
      mateIn: null,
      bestMove: null,
      topMoves: [],
      depth: 0,
    };
  }

  const maximizing = state.turn === 'w';
  let searchNodes = 0;
  let searchStopped = false;
  const transTable = new Map<string, TTEntry>();

  const quiescence = (
    pos: PositionState,
    alpha: number,
    beta: number,
    isMax: boolean,
    ply = 0
  ): number => {
    searchNodes++;
    if (searchNodes > maxNodes) {
      searchStopped = true;
      return evaluateBoard(pos.b);
    }

    const col: PieceColor = isMax ? 'w' : 'b';
    const isChecked = isInCheck(pos.b, col);
    const stand = evaluateBoard(pos.b);

    if (ply >= 6) return stand;

    let qMoves = legalMovesFor(pos.b, col, pos.rights, pos.ep);
    if (!qMoves.length) {
      if (isChecked) return isMax ? -30000 + ply : 30000 - ply;
      return 0;
    }

    if (!isChecked) {
      if (isMax) {
        if (stand >= beta) return stand;
        alpha = Math.max(alpha, stand);
      } else {
        if (stand <= alpha) return stand;
        beta = Math.min(beta, stand);
      }
      qMoves = qMoves.filter((m) => m.capture || m.promotion);
    }

    if (!qMoves.length) return stand;
    qMoves.sort((a, b) => moveOrderScore(b) - moveOrderScore(a));
    let best = isChecked ? (isMax ? -Infinity : Infinity) : stand;

    for (const m of qMoves) {
      if (searchStopped) break;
      const n = applyMoveToPosition({ ...pos, turn: col }, m);
      const sc = quiescence(
        { b: n.b, rights: n.rights, ep: n.ep },
        alpha,
        beta,
        !isMax,
        ply + 1
      );
      if (isMax) {
        best = Math.max(best, sc);
        alpha = Math.max(alpha, best);
      } else {
        best = Math.min(best, sc);
        beta = Math.min(beta, best);
      }
      if (beta <= alpha) break;
    }

    return best;
  };

  const alphaBeta = (
    pos: PositionState,
    depth: number,
    alpha: number,
    beta: number,
    isMax: boolean,
    ply = 0
  ): number => {
    searchNodes++;
    if (searchNodes > maxNodes) {
      searchStopped = true;
      return evaluateBoard(pos.b);
    }

    const col: PieceColor = isMax ? 'w' : 'b';
    const alphaOriginal = alpha;
    const betaOriginal = beta;
    const key = positionKey(pos, isMax);
    const cached = transTable.get(key);
    let preferred: Move | null = null;

    if (cached) {
      preferred = cached.move;
      if (cached.depth >= depth) {
        if (cached.flag === 'EXACT') return cached.score;
        if (cached.flag === 'LOWER') alpha = Math.max(alpha, cached.score);
        else if (cached.flag === 'UPPER') beta = Math.min(beta, cached.score);
        if (alpha >= beta) return cached.score;
      }
    }

    if (depth <= 0) {
      return quiescence(pos, alpha, beta, isMax, ply);
    }

    const legal = legalMovesFor(pos.b, col, pos.rights, pos.ep);
    if (!legal.length) {
      return isInCheck(pos.b, col) ? (isMax ? -30000 + ply : 30000 - ply) : 0;
    }

    legal.sort((a, b) => {
      if (preferred) {
        const am = sameMove(a, preferred);
        const bm = sameMove(b, preferred);
        if (am !== bm) return am ? -1 : 1;
      }
      return moveOrderScore(b) - moveOrderScore(a);
    });

    let bestMove: Move | null = null;
    let value = isMax ? -Infinity : Infinity;

    for (const move of legal) {
      if (searchStopped) break;
      const next = applyMoveToPosition({ ...pos, turn: col }, move);
      const sc = alphaBeta(
        { b: next.b, rights: next.rights, ep: next.ep },
        depth - 1,
        alpha,
        beta,
        !isMax,
        ply + 1
      );
      if (isMax) {
        if (sc > value) {
          value = sc;
          bestMove = move;
        }
        alpha = Math.max(alpha, value);
      } else {
        if (sc < value) {
          value = sc;
          bestMove = move;
        }
        beta = Math.min(beta, value);
      }
      if (beta <= alpha) break;
    }

    if (!searchStopped) {
      const flag =
        value <= alphaOriginal
          ? 'UPPER'
          : value >= betaOriginal
            ? 'LOWER'
            : 'EXACT';
      if (transTable.size > 60000) transTable.clear();
      transTable.set(key, { depth, score: value, flag, move: bestMove });
    }
    return value;
  };

  // Evaluate all root moves at depth 1 first so we always have ordered baseline scores
  const scoredRoots: { move: Move; score: number }[] = moves
    .slice()
    .sort((a, b) => moveOrderScore(b) - moveOrderScore(a))
    .map((m) => {
      const next = applyMoveToPosition(
        { b: state.b, turn: state.turn, rights: state.rights },
        m
      );
      const sc = alphaBeta(
        { b: next.b, rights: next.rights, ep: next.ep },
        0,
        -Infinity,
        Infinity,
        !maximizing,
        1
      );
      return { move: m, score: sc };
    });

  scoredRoots.sort((a, b) => (maximizing ? b.score - a.score : a.score - b.score));
  let completedDepth = 1;

  for (let depth = 2; depth <= maxDepth; depth++) {
    searchStopped = false;
    const updated: { move: Move; score: number }[] = [];
    for (const item of scoredRoots) {
      if (searchStopped) break;
      const next = applyMoveToPosition(
        { b: state.b, turn: state.turn, rights: state.rights },
        item.move
      );
      const sc = alphaBeta(
        { b: next.b, rights: next.rights, ep: next.ep },
        depth - 1,
        -Infinity,
        Infinity,
        !maximizing,
        1
      );
      updated.push({ move: item.move, score: sc });
    }
    if (!searchStopped && updated.length === scoredRoots.length) {
      updated.sort((a, b) => (maximizing ? b.score - a.score : a.score - b.score));
      scoredRoots.splice(0, scoredRoots.length, ...updated);
      completedDepth = depth;
    } else {
      break;
    }
  }

  const topMoves: CandidateMove[] = scoredRoots.slice(0, 3).map((item) => {
    const from = sqName(item.move.from);
    const to = sqName(item.move.to);
    return {
      from,
      to,
      promotion: item.move.promotion || null,
      piece: item.move.piece,
      scoreCp: item.score,
      mateIn: extractMateIn(item.score),
      label: formatMoveLabel(from, to, item.move.promotion, item.move.capture),
    };
  });

  const best = topMoves[0] || null;
  return {
    scoreCp: best ? best.scoreCp : evaluateBoard(state.b),
    mateIn: best ? best.mateIn : null,
    bestMove: best,
    topMoves,
    depth: completedDepth,
  };
}

export function classifyMoveQuality(
  cpLoss: number,
  playedIsBest: boolean
): MoveQuality {
  if (playedIsBest || cpLoss <= 15) return 'best';
  if (cpLoss <= 60) return 'good';
  if (cpLoss <= 130) return 'inaccuracy';
  if (cpLoss <= 280) return 'mistake';
  return 'blunder';
}

export function computeAccuracyPercent(cpLosses: number[]): number {
  if (!cpLosses.length) return 100;
  const avgLoss = cpLosses.reduce((a, b) => a + b, 0) / cpLosses.length;
  return Math.max(0, Math.min(100, Math.round(100 * Math.exp(-0.004 * avgLoss))));
}

export function replayHistoryToPly(
  history: HistoryEntry[],
  targetPly: number,
  initialMinutes = 10
): GameState {
  let state = createInitialState(initialMinutes);
  const clamped = Math.max(0, Math.min(targetPly, history.length));
  for (let i = 0; i < clamped; i++) {
    const h = history[i];
    const match = findMatchingLegalMove(state, h.from, h.to, h.promotion);
    if (!match) break;
    state = executeMoveOnState(state, match, false).nextState;
  }
  return state;
}

