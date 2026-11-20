import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  findKing,
  isInCheck,
  legalMovesFor,
  nameSq,
  pieceColor,
  sqName,
  type GameState,
  type Move,
  type PieceChar,
  type PieceColor,
  type SquareCoord,
} from '../shared/chessEngine.ts';
import { LineChart, Minimize2, RotateCcw, X } from 'lucide-react';
import { ChessPieceSvg } from './ChessPieceSvg.tsx';

export type BoardTheme = 'wood' | 'green' | 'blue';

const BOARD_THEMES: Record<BoardTheme, { light: string; dark: string }> = {
  wood: { light: '#eee2cc', dark: '#9b7653' },
  green: { light: '#eeeed2', dark: '#769656' },
  blue: { light: '#dee3e6', dark: '#8ca2ad' },
};

interface ChessBoardProps {
  gameState: GameState;
  canInteractColor: PieceColor | 'both' | null;
  flipped: boolean;
  theme: BoardTheme;
  expanded: boolean;
  onToggleExpand: (next: boolean) => void;
  onMove: (move: Move) => void;
  onNewGame?: () => void;
  newGameLabel?: string;
  bestMoveArrow?: { from: string; to: string } | null;
  secondaryArrow?: { from: string; to: string } | null;
  hideGameOverModal?: boolean;
  onAnalyzeGame?: () => void;
}

interface DragState {
  from: SquareCoord | null;
  start: SquareCoord;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  moved: boolean;
  piece: PieceChar | null;
}

export const ChessBoard: React.FC<ChessBoardProps> = ({
  gameState,
  canInteractColor,
  flipped,
  theme,
  expanded,
  onToggleExpand,
  onMove,
  onNewGame,
  newGameLabel = 'لعبة جديدة',
  bestMoveArrow = null,
  secondaryArrow = null,
  hideGameOverModal = false,
  onAnalyzeGame,
}) => {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [selected, setSelected] = useState<SquareCoord | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<Move | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [dismissedGameOver, setDismissedGameOver] = useState(false);

  const colors = BOARD_THEMES[theme];
  const allLegal = useMemo(
    () =>
      legalMovesFor(
        gameState.b,
        gameState.turn,
        gameState.rights,
        gameState.ep
      ),
    [gameState.b, gameState.turn, gameState.rights, gameState.ep]
  );

  const legalForSelected = useMemo(() => {
    if (!selected) return [];
    return allLegal.filter(
      (m) => m.from[0] === selected[0] && m.from[1] === selected[1]
    );
  }, [allLegal, selected]);

  // Clear selection whenever board turn or position changes
  useEffect(() => {
    setSelected(null);
    setPendingPromotion(null);
  }, [gameState.history.length, gameState.turn, gameState.over]);

  // Re-arm Game Over modal whenever a new game starts or game ends again
  useEffect(() => {
    if (!gameState.over) {
      setDismissedGameOver(false);
    }
  }, [gameState.over, gameState.history.length]);

  // Close expanded view on Escape
  useEffect(() => {
    if (!expanded) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onToggleExpand(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [expanded, onToggleExpand]);

  const isTurnAllowed =
    !gameState.over &&
    canInteractColor !== null &&
    (canInteractColor === 'both' || canInteractColor === gameState.turn);

  const commitOrPromote = (move: Move) => {
    if (move.promotion) {
      setPendingPromotion(move);
      return;
    }
    setSelected(null);
    onMove(move);
  };

  const handleSquareTap = (r: number, c: number) => {
    if (!isTurnAllowed) return;
    const clickedPiece = gameState.b[r][c];

    if (selected) {
      const targetMove = legalForSelected.find(
        (m) => m.to[0] === r && m.to[1] === c
      );
      if (targetMove) {
        commitOrPromote(targetMove);
        return;
      }
    }

    if (pieceColor(clickedPiece) === gameState.turn) {
      setSelected([r, c]);
    } else {
      setSelected(null);
    }
  };

  const getBoardSquareFromPoint = (
    clientX: number,
    clientY: number
  ): SquareCoord | null => {
    const el = boardRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    ) {
      return null;
    }
    const vc = Math.min(
      7,
      Math.max(0, Math.floor(((clientX - rect.left) / rect.width) * 8))
    );
    const vr = Math.min(
      7,
      Math.max(0, Math.floor(((clientY - rect.top) / rect.height) * 8))
    );
    return [flipped ? 7 - vr : vr, flipped ? 7 - vc : vc];
  };

  useEffect(() => {
    if (!drag) return;

    const handleMove = (e: PointerEvent) => {
      if (e.pointerId !== drag.pointerId) return;
      const dist = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
      setDrag((prev) =>
        prev && prev.pointerId === e.pointerId
          ? {
              ...prev,
              x: e.clientX,
              y: e.clientY,
              moved: prev.moved || dist > 7,
            }
          : prev
      );
    };

    const handleUp = (e: PointerEvent) => {
      if (e.pointerId !== drag.pointerId) return;
      const activeDrag = drag;
      setDrag(null);

      if (activeDrag.moved && activeDrag.from) {
        const dest = getBoardSquareFromPoint(e.clientX, e.clientY);
        if (!dest) {
          setSelected(null);
          return;
        }
        const match = allLegal.find(
          (m) =>
            m.from[0] === activeDrag.from![0] &&
            m.from[1] === activeDrag.from![1] &&
            m.to[0] === dest[0] &&
            m.to[1] === dest[1]
        );
        if (match) {
          commitOrPromote(match);
        } else if (
          dest[0] === activeDrag.from[0] &&
          dest[1] === activeDrag.from[1]
        ) {
          setSelected(activeDrag.from);
        } else {
          setSelected(null);
        }
      } else if (!activeDrag.moved) {
        handleSquareTap(activeDrag.start[0], activeDrag.start[1]);
      }
    };

    const handleCancel = () => setDrag(null);

    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
    document.addEventListener('pointercancel', handleCancel);
    return () => {
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
      document.removeEventListener('pointercancel', handleCancel);
    };
  });

  const inCheck = isInCheck(gameState.b, gameState.turn);
  const kingSq = inCheck ? findKing(gameState.b, gameState.turn) : null;
  const lastHistory = gameState.history[gameState.history.length - 1];

  const promoChoices: PieceChar[] =
    gameState.turn === 'w' ? ['Q', 'R', 'B', 'N'] : ['q', 'r', 'b', 'n'];

  return (
    <div
      className={
        expanded
          ? 'fixed inset-0 z-50 flex items-center justify-center bg-[#0b0f16] p-2 sm:p-4'
          : 'relative w-full'
      }
    >
      {expanded && (
        <button
          type="button"
          onClick={() => onToggleExpand(false)}
          className="fixed top-3 right-3 z-[60] flex items-center gap-2 rounded-lg border border-white/20 bg-[#161e2b]/95 px-3.5 py-2 text-xs font-bold text-white shadow-lg transition hover:bg-[#1f2a3c] whitespace-nowrap"
        >
          <Minimize2 className="h-4 w-4" />
          إغلاق التكبير
        </button>
      )}

      <div
        className={
          expanded
            ? 'relative aspect-square w-[min(96vw,92dvh)] overflow-hidden rounded-lg shadow-2xl'
            : 'relative aspect-square w-full overflow-hidden rounded-xl border border-white/10 shadow-[0_14px_34px_rgba(0,0,0,0.45)]'
        }
      >
        <div
          ref={boardRef}
          dir="ltr"
          aria-label="رقعة الشطرنج"
          className="grid h-full w-full grid-cols-8 grid-rows-8 touch-none select-none"
        >
          {Array.from({ length: 64 }).map((_, idx) => {
            const vr = Math.floor(idx / 8);
            const vc = idx % 8;
            const r = flipped ? 7 - vr : vr;
            const c = flipped ? 7 - vc : vc;
            const isDark = (r + c) % 2 === 1;
            const sq = sqName([r, c]);

            const isLast =
              !!lastHistory &&
              (lastHistory.from === sq || lastHistory.to === sq);
            const isSelected =
              !!selected && selected[0] === r && selected[1] === c;
            const isKingCheck =
              !!kingSq && kingSq[0] === r && kingSq[1] === c;

            const piece = gameState.b[r][c];
            const isBeingDragged =
              !!drag?.moved &&
              drag.from?.[0] === r &&
              drag.from?.[1] === c;

            const legalTarget = selected
              ? legalForSelected.find((m) => m.to[0] === r && m.to[1] === c)
              : undefined;

            const showRank = vc === 0;
            const showFile = vr === 7;
            const coordColor = isDark ? colors.light : colors.dark;

            return (
              <div
                key={sq}
                onPointerDown={(e) => {
                  if (e.button !== 0 && e.pointerType === 'mouse') return;
                  const current = gameState.b[r][c];
                  const canDrag =
                    isTurnAllowed &&
                    !!current &&
                    pieceColor(current) === gameState.turn;

                  if (canDrag) {
                    setSelected([r, c]);
                  }

                  setDrag({
                    from: canDrag ? [r, c] : null,
                    start: [r, c],
                    pointerId: e.pointerId,
                    startX: e.clientX,
                    startY: e.clientY,
                    x: e.clientX,
                    y: e.clientY,
                    moved: false,
                    piece: canDrag ? current : null,
                  });
                }}
                style={{
                  backgroundColor: isDark ? colors.dark : colors.light,
                }}
                className="relative grid cursor-pointer place-items-center"
              >
                {isLast && (
                  <div className="pointer-events-none absolute inset-0 bg-[#d9d044]/40" />
                )}
                {isSelected && (
                  <div className="pointer-events-none absolute inset-0 bg-[#2bb673]/50" />
                )}
                {isKingCheck && (
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      backgroundImage:
                        'radial-gradient(circle, rgba(239,68,68,0.85) 8%, rgba(220,38,38,0.65) 75%)',
                    }}
                  />
                )}

                {showRank && (
                  <span
                    style={{ color: coordColor }}
                    className="pointer-events-none absolute top-0.5 left-1 z-10 text-[10px] font-bold opacity-85"
                  >
                    {8 - r}
                  </span>
                )}
                {showFile && (
                  <span
                    style={{ color: coordColor }}
                    className="pointer-events-none absolute right-1 bottom-0.5 z-10 text-[10px] font-bold opacity-85"
                  >
                    {'abcdefgh'[c]}
                  </span>
                )}

                {piece && !isBeingDragged && (
                  <ChessPieceSvg
                    piece={piece}
                    className="relative z-20 h-[86%] w-[86%] drop-shadow-[0_2px_2px_rgba(0,0,0,0.32)] transition-transform duration-100"
                  />
                )}

                {legalTarget && (
                  <div
                    className={
                      piece || legalTarget.ep
                        ? 'pointer-events-none absolute inset-[6%] z-30 rounded-full border-[4px] border-[#ef4444]/85 shadow-[inset_0_0_0_2px_rgba(255,255,255,0.45)]'
                        : 'pointer-events-none z-30 h-[30%] w-[30%] rounded-full border-2 border-[#eafff0]/80 bg-[#0b7a44]/80 shadow-sm'
                    }
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Engine Best Move & Candidate Arrow Overlay */}
        {(bestMoveArrow || secondaryArrow) && (
          <svg
            viewBox="0 0 800 800"
            className="pointer-events-none absolute inset-0 z-30 h-full w-full"
          >
            <defs>
              <marker
                id="mc-arrow-best"
                markerWidth="5"
                markerHeight="5"
                refX="3.2"
                refY="2.5"
                orient="auto"
              >
                <polygon points="0 0.5, 4.5 2.5, 0 4.5" fill="#2bb673" />
              </marker>
              <marker
                id="mc-arrow-alt"
                markerWidth="5"
                markerHeight="5"
                refX="3.2"
                refY="2.5"
                orient="auto"
              >
                <polygon points="0 0.5, 4.5 2.5, 0 4.5" fill="#d4a84b" />
              </marker>
            </defs>
            {[
              { arrow: secondaryArrow, color: '#d4a84b', marker: 'url(#mc-arrow-alt)', opacity: 0.72, width: 14 },
              { arrow: bestMoveArrow, color: '#2bb673', marker: 'url(#mc-arrow-best)', opacity: 0.88, width: 17 },
            ].map((item, idx) => {
              if (!item.arrow) return null;
              const [fr, fc] = nameSq(item.arrow.from);
              const [tr, tc] = nameSq(item.arrow.to);
              const x1 = (flipped ? 7 - fc : fc) * 100 + 50;
              const y1 = (flipped ? 7 - fr : fr) * 100 + 50;
              const x2 = (flipped ? 7 - tc : tc) * 100 + 50;
              const y2 = (flipped ? 7 - tr : tr) * 100 + 50;
              const dx = x2 - x1;
              const dy = y2 - y1;
              const len = Math.hypot(dx, dy) || 1;
              const shortenEnd = 22;
              const ex = x2 - (dx / len) * shortenEnd;
              const ey = y2 - (dy / len) * shortenEnd;
              return (
                <line
                  key={`${idx}-${item.arrow.from}-${item.arrow.to}`}
                  x1={x1}
                  y1={y1}
                  x2={ex}
                  y2={ey}
                  stroke={item.color}
                  strokeWidth={item.width}
                  strokeLinecap="round"
                  opacity={item.opacity}
                  markerEnd={item.marker}
                />
              );
            })}
          </svg>
        )}

        {/* Promotion Dialog */}
        {pendingPromotion && (
          <div className="absolute inset-0 z-40 grid place-items-center bg-black/70 p-4 backdrop-blur-[2px]">
            <div className="w-full max-w-[300px] rounded-xl border border-white/15 bg-[#161e2b] p-5 text-center shadow-2xl">
              <h3 className="text-base font-bold text-white">ترقية البيدق</h3>
              <p className="mt-1 text-xs text-[#9aa8bd]">
                اختر القطعة التي تريد الترقية إليها
              </p>
              <div className="mt-4 flex justify-center gap-2.5">
                {promoChoices.map((pr) => (
                  <button
                    key={pr}
                    type="button"
                    onClick={() => {
                      const chosenMove: Move = {
                        ...pendingPromotion,
                        promotion: pr,
                        promoted: true,
                      };
                      setPendingPromotion(null);
                      setSelected(null);
                      onMove(chosenMove);
                    }}
                    className="grid h-14 w-14 place-items-center rounded-lg border border-white/15 bg-[#222d3f] p-2 transition hover:border-[#2bb673] hover:bg-[#28364b]"
                  >
                    <ChessPieceSvg piece={pr} className="h-full w-full" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Game Over Overlay inside board */}
        {gameState.over &&
          gameState.resultText &&
          !hideGameOverModal &&
          !dismissedGameOver && (
            <div className="absolute inset-0 z-40 grid place-items-center bg-black/65 p-4 backdrop-blur-[2px]">
              <div className="relative w-full max-w-[320px] rounded-xl border border-white/15 bg-[#161e2b] p-6 text-center shadow-2xl">
                <button
                  type="button"
                  onClick={() => setDismissedGameOver(true)}
                  aria-label="إغلاق لرؤية الرقعة"
                  title="إغلاق لرؤية الكش على الرقعة"
                  className="absolute top-3 left-3 grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-[#1e2838] text-[#cbd5e1] transition hover:bg-[#273449] hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
                <h3 className="text-lg font-extrabold text-[#d4a84b]">
                  انتهت المباراة
                </h3>
                <p className="mt-2 text-sm font-semibold text-white">
                  {gameState.resultText}
                </p>
                <div className="mt-5 space-y-2.5">
                  {onAnalyzeGame && (
                    <button
                      type="button"
                      onClick={onAnalyzeGame}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#d4a84b]/45 bg-[#d4a84b]/15 px-4 py-2.5 text-sm font-bold text-[#f2d28b] transition hover:bg-[#d4a84b]/25"
                    >
                      <LineChart className="h-4 w-4" />
                      تحليل المباراة وأفضل النقلات
                    </button>
                  )}
                  {onNewGame && (
                    <button
                      type="button"
                      onClick={onNewGame}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#2bb673] px-4 py-2.5 text-sm font-bold text-[#072115] transition hover:bg-[#32c87f]"
                    >
                      <RotateCcw className="h-4 w-4" />
                      {newGameLabel}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
      </div>

      {/* Compact bar below board after closing Game Over overlay */}
      {!expanded &&
        gameState.over &&
        gameState.resultText &&
        !hideGameOverModal &&
        dismissedGameOver && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#d4a84b]/35 bg-[#161e2b] px-3.5 py-2.5">
            <span className="text-xs font-bold text-[#f2d28b]">
              {gameState.resultText}
            </span>
            <div className="flex items-center gap-1.5">
              {onAnalyzeGame && (
                <button
                  type="button"
                  onClick={onAnalyzeGame}
                  className="inline-flex items-center gap-1 rounded-md border border-[#d4a84b]/40 bg-[#d4a84b]/15 px-2.5 py-1.5 text-[11px] font-bold text-[#f2d28b] transition hover:bg-[#d4a84b]/25"
                >
                  <LineChart className="h-3.5 w-3.5" />
                  تحليل
                </button>
              )}
              {onNewGame && (
                <button
                  type="button"
                  onClick={onNewGame}
                  className="inline-flex items-center gap-1 rounded-md bg-[#2bb673] px-2.5 py-1.5 text-[11px] font-extrabold text-[#072115] transition hover:bg-[#32c87f]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {newGameLabel}
                </button>
              )}
            </div>
          </div>
        )}

      {/* Floating piece while dragging */}
      {drag?.moved && drag.piece && (
        <div
          style={{
            left: drag.x,
            top: drag.y,
            transform: 'translate(-50%, -55%) scale(1.18)',
          }}
          className="pointer-events-none fixed z-[70] h-[58px] w-[58px]"
        >
          <ChessPieceSvg
            piece={drag.piece}
            className="h-full w-full drop-shadow-[0_6px_10px_rgba(0,0,0,0.55)]"
          />
        </div>
      )}
    </div>
  );
};
