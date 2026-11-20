import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  EyeOff,
  LineChart,
  Play,
  Square,
  X,
} from 'lucide-react';
import {
  formatEvalScore,
  PIECE_SYMBOLS,
  type CandidateMove,
  type MoveAnalysisEntry,
  type MoveQuality,
  type PositionAnalysis,
} from '../shared/chessEngine.ts';
import type { AnalysisSummary } from '../hooks/useGameAnalysis.ts';

interface AnalysisPanelProps {
  totalPlies: number;
  reviewPly: number;
  onSelectPly: (ply: number) => void;
  isAnalyzing: boolean;
  progress: number;
  entries: MoveAnalysisEntry[];
  summary: AnalysisSummary;
  currentPositionAnalysis: PositionAnalysis | null;
  showBestArrow: boolean;
  onToggleBestArrow: () => void;
  onStartAnalysis: () => void;
  onCancelAnalysis: () => void;
  onCloseReview: () => void;
  onHoverCandidate: (arrow: { from: string; to: string } | null) => void;
}

const QUALITY_LABELS: Record<
  MoveQuality,
  { text: string; symbol: string; colorClass: string }
> = {
  best: { text: 'أفضل نقلة', symbol: '★', colorClass: 'text-[#2bb673]' },
  good: { text: 'نقلة جيدة', symbol: '✓', colorClass: 'text-[#7dd3fc]' },
  inaccuracy: {
    text: 'عدم دقة',
    symbol: '?!',
    colorClass: 'text-[#facc15]',
  },
  mistake: { text: 'خطأ', symbol: '?', colorClass: 'text-[#fb923c]' },
  blunder: { text: 'خطأ فادح', symbol: '??', colorClass: 'text-[#ef4444]' },
};

function scoreToWhiteBarPercent(
  scoreCp: number,
  mateIn: number | null
): number {
  if (mateIn !== null) return mateIn > 0 ? 97 : 3;
  // Smooth sigmoid mapping [-800..+800] cp into [6%..94%]
  const clamped = Math.max(-1000, Math.min(1000, scoreCp));
  const pct = 50 + 44 * Math.tanh(clamped / 360);
  return Math.max(4, Math.min(96, pct));
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
  totalPlies,
  reviewPly,
  onSelectPly,
  isAnalyzing,
  progress,
  entries,
  summary,
  currentPositionAnalysis,
  showBestArrow,
  onToggleBestArrow,
  onStartAnalysis,
  onCancelAnalysis,
  onCloseReview,
  onHoverCandidate,
}) => {
  const playedEntry = reviewPly > 0 ? entries[reviewPly - 1] : undefined;
  const evalText = currentPositionAnalysis
    ? formatEvalScore(
        currentPositionAnalysis.scoreCp,
        currentPositionAnalysis.mateIn
      )
    : '0.0';

  const whitePct = currentPositionAnalysis
    ? scoreToWhiteBarPercent(
        currentPositionAnalysis.scoreCp,
        currentPositionAnalysis.mateIn
      )
    : 50;

  return (
    <div className="rounded-xl border border-[#d4a84b]/30 bg-[#161e2b] p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <LineChart className="h-4 w-4 text-[#d4a84b]" />
          <h2 className="text-sm font-extrabold text-white">
            تحليل المباراة بالمحرك
          </h2>
        </div>

        <button
          type="button"
          onClick={onCloseReview}
          className="inline-flex items-center gap-1 rounded-lg border border-white/12 bg-[#1e2838] px-2.5 py-1 text-xs font-bold text-[#cbd5e1] transition hover:bg-[#273449] hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
          إنهاء المراجعة
        </button>
      </div>

      {/* Start / Progress Bar */}
      <div className="flex items-center gap-2">
        {isAnalyzing ? (
          <>
            <div className="flex-1">
              <div className="mb-1 flex justify-between text-[11px] font-bold text-[#dce5f2] tabular-nums">
                <span>جاري تحليل النقلات...</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#101621]">
                <div
                  style={{ width: `${progress}%` }}
                  className="h-full bg-[#2bb673] transition-all duration-150"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={onCancelAnalysis}
              className="inline-flex items-center gap-1 rounded-lg border border-[#ef4444]/40 bg-[#ef4444]/15 px-3 py-1.5 text-xs font-bold text-[#fca5a5] transition hover:bg-[#ef4444]/25"
            >
              <Square className="h-3.5 w-3.5" />
              إيقاف
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={totalPlies === 0}
            onClick={onStartAnalysis}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#d4a84b] px-4 py-2 text-xs font-extrabold text-[#1d1404] transition hover:bg-[#e1b860] disabled:opacity-45"
          >
            <Play className="h-3.5 w-3.5" />
            {entries.length === totalPlies && totalPlies > 0
              ? 'إعادة تحليل كامل المباراة'
              : 'تحليل كامل المباراة وتقييم كل حركة'}
          </button>
        )}

        <button
          type="button"
          onClick={onToggleBestArrow}
          title="إظهار أو إخفاء سهم أفضل نقلة"
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition whitespace-nowrap ${
            showBestArrow
              ? 'border-[#2bb673]/50 bg-[#2bb673]/15 text-[#6ae3aa]'
              : 'border-white/12 bg-[#1e2838] text-[#9aa8bd]'
          }`}
        >
          {showBestArrow ? (
            <Eye className="h-3.5 w-3.5" />
          ) : (
            <EyeOff className="h-3.5 w-3.5" />
          )}
          السهم
        </button>
      </div>

      {/* Horizontal Advantage Bar & Current Move Critique */}
      <div className="rounded-lg bg-[#101621] p-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-bold text-[#9aa8bd]">
            تقييم الوضع عند النقلة{' '}
            <span className="font-mono-tabular text-white">
              {reviewPly}/{totalPlies}
            </span>
          </span>
          <span
            dir="ltr"
            className="font-mono-tabular rounded bg-[#1e2838] px-2 py-0.5 text-sm font-extrabold text-white"
          >
            {evalText}
          </span>
        </div>

        <div className="flex h-2.5 overflow-hidden rounded-full border border-white/10 bg-[#1a1d24]">
          <div
            style={{ width: `${whitePct}%` }}
            className="bg-[#f2f5fa] transition-all duration-200"
          />
        </div>

        {playedEntry && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-xs">
            <div className="flex items-center gap-1.5">
              <span
                className={`font-bold ${QUALITY_LABELS[playedEntry.quality].colorClass}`}
              >
                {QUALITY_LABELS[playedEntry.quality].symbol}{' '}
                {QUALITY_LABELS[playedEntry.quality].text}
              </span>
              <span className="text-[#9aa8bd]">·</span>
              <span dir="ltr" className="font-mono-tabular font-bold text-white">
                {playedEntry.playedLabel}
              </span>
            </div>

            {playedEntry.bestMoveBefore &&
              playedEntry.quality !== 'best' && (
                <span className="text-[11px] text-[#9aa8bd]">
                  الأفضل كان:{' '}
                  <span
                    dir="ltr"
                    className="font-mono-tabular font-bold text-[#2bb673]"
                  >
                    {playedEntry.bestMoveBefore.label}
                  </span>
                </span>
              )}
          </div>
        )}
      </div>

      {/* Top 3 Candidate Moves for Current Position */}
      <div>
        <div className="mb-1.5 text-xs font-bold text-[#dce5f2]">
          أفضل النقلات الممكنة في هذا الوضع
        </div>
        {!currentPositionAnalysis ||
        currentPositionAnalysis.topMoves.length === 0 ? (
          <div className="rounded-lg bg-[#101621] py-3 text-center text-xs text-[#76859b]">
            لا توجد نقلات قانونية متاحة (نهاية المباراة)
          </div>
        ) : (
          <div className="space-y-1.5">
            {currentPositionAnalysis.topMoves.map(
              (cand: CandidateMove, idx: number) => (
                <div
                  key={`${cand.from}-${cand.to}-${cand.promotion || ''}`}
                  onMouseEnter={() =>
                    onHoverCandidate({ from: cand.from, to: cand.to })
                  }
                  onMouseLeave={() => onHoverCandidate(null)}
                  className="flex items-center justify-between rounded-lg border border-white/8 bg-[#101621] px-3 py-1.5 text-xs transition hover:border-[#d4a84b]/45"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono-tabular text-[#76859b]">
                      {idx + 1}.
                    </span>
                    <span className="chess-piece-glyph text-base leading-none text-white">
                      {PIECE_SYMBOLS[cand.piece]}
                    </span>
                    <span
                      dir="ltr"
                      className="font-mono-tabular font-bold text-white"
                    >
                      {cand.label}
                    </span>
                    {idx === 0 && (
                      <span className="text-[11px] font-bold text-[#2bb673]">
                        · الأفضل
                      </span>
                    )}
                  </div>

                  <span
                    dir="ltr"
                    className={`font-mono-tabular font-bold ${
                      cand.scoreCp >= 0 ? 'text-[#f2f5fa]' : 'text-[#9aa8bd]'
                    }`}
                  >
                    {formatEvalScore(cand.scoreCp, cand.mateIn)}
                  </span>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* Interactive Eval Sparkline Chart */}
      {entries.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-bold text-[#dce5f2]">منحنى تقييم المباراة</span>
            <span className="text-[11px] text-[#9aa8bd]">
              اضغط على أي نقطة للانتقال
            </span>
          </div>
          <div className="rounded-lg bg-[#101621] p-2">
            <svg viewBox="0 0 320 72" className="h-16 w-full overflow-visible">
              <line
                x1="0"
                y1="36"
                x2="320"
                y2="36"
                stroke="rgba(255,255,255,0.14)"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              {(() => {
                const pts = entries.map((e, i) => {
                  const x =
                    entries.length === 1
                      ? 160
                      : (i / (entries.length - 1)) * 312 + 4;
                  const clamped =
                    e.mateIn !== null
                      ? e.mateIn > 0
                        ? 900
                        : -900
                      : Math.max(-800, Math.min(800, e.scoreCp));
                  const y = 36 - (clamped / 800) * 30;
                  return { x, y, ply: e.ply, quality: e.quality };
                });

                const pathD = pts
                  .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
                  .join(' ');

                return (
                  <>
                    <path
                      d={pathD}
                      fill="none"
                      stroke="#2bb673"
                      strokeWidth="2"
                    />
                    {pts.map((p) => {
                      const isCurrent = p.ply === reviewPly;
                      const dotColor =
                        p.quality === 'blunder'
                          ? '#ef4444'
                          : p.quality === 'mistake'
                            ? '#fb923c'
                            : isCurrent
                              ? '#d4a84b'
                              : '#2bb673';
                      return (
                        <circle
                          key={p.ply}
                          cx={p.x}
                          cy={p.y}
                          r={isCurrent ? 4.5 : p.quality === 'blunder' || p.quality === 'mistake' ? 3 : 2}
                          fill={dotColor}
                          className="cursor-pointer"
                          onClick={() => onSelectPly(p.ply)}
                        />
                      );
                    })}
                  </>
                );
              })()}
            </svg>
          </div>
        </div>
      )}

      {/* Accuracy & Move Quality Summary */}
      {entries.length > 0 && (
        <div className="rounded-lg bg-[#101621] p-3 text-xs space-y-2">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-md bg-[#161e2b] p-2">
              <div className="text-[11px] text-[#9aa8bd]">دقة الأبيض ⚪</div>
              <div className="font-mono-tabular mt-0.5 text-base font-extrabold text-white">
                {summary.whiteAccuracy}%
              </div>
              <div className="mt-1 text-[11px] text-[#9aa8bd] tabular-nums">
                ★ {summary.counts.w.best} · ?! {summary.counts.w.inaccuracy} · ?{' '}
                {summary.counts.w.mistake} · ?? {summary.counts.w.blunder}
              </div>
            </div>

            <div className="rounded-md bg-[#161e2b] p-2">
              <div className="text-[11px] text-[#9aa8bd]">دقة الأسود ⚫</div>
              <div className="font-mono-tabular mt-0.5 text-base font-extrabold text-white">
                {summary.blackAccuracy}%
              </div>
              <div className="mt-1 text-[11px] text-[#9aa8bd] tabular-nums">
                ★ {summary.counts.b.best} · ?! {summary.counts.b.inaccuracy} · ?{' '}
                {summary.counts.b.mistake} · ?? {summary.counts.b.blunder}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ply Playback Controls */}
      <div dir="ltr" className="grid grid-cols-4 gap-1.5">
        <button
          type="button"
          disabled={reviewPly <= 0}
          onClick={() => onSelectPly(0)}
          aria-label="أول نقلة"
          className="grid place-items-center rounded-lg border border-white/12 bg-[#1e2838] py-2 text-white transition hover:bg-[#273449] disabled:opacity-40"
        >
          <ChevronsLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={reviewPly <= 0}
          onClick={() => onSelectPly(Math.max(0, reviewPly - 1))}
          aria-label="النقلة السابقة"
          className="grid place-items-center rounded-lg border border-white/12 bg-[#1e2838] py-2 text-white transition hover:bg-[#273449] disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={reviewPly >= totalPlies}
          onClick={() => onSelectPly(Math.min(totalPlies, reviewPly + 1))}
          aria-label="النقلة التالية"
          className="grid place-items-center rounded-lg border border-white/12 bg-[#1e2838] py-2 text-white transition hover:bg-[#273449] disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={reviewPly >= totalPlies}
          onClick={() => onSelectPly(totalPlies)}
          aria-label="آخر نقلة"
          className="grid place-items-center rounded-lg border border-white/12 bg-[#1e2838] py-2 text-white transition hover:bg-[#273449] disabled:opacity-40"
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
