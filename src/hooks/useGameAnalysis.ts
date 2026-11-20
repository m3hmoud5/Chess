import { useCallback, useMemo, useRef, useState } from 'react';
import {
  analyzePosition,
  classifyMoveQuality,
  computeAccuracyPercent,
  createInitialState,
  executeMoveOnState,
  findMatchingLegalMove,
  formatMoveLabel,
  type GameState,
  type HistoryEntry,
  type MoveAnalysisEntry,
  type MoveQuality,
  type PositionAnalysis,
} from '../shared/chessEngine.ts';

export interface AnalysisSummary {
  whiteAccuracy: number;
  blackAccuracy: number;
  counts: {
    w: Record<MoveQuality, number>;
    b: Record<MoveQuality, number>;
  };
}

function emptyCounts(): Record<MoveQuality, number> {
  return { best: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 };
}

export function useGameAnalysis() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [entries, setEntries] = useState<MoveAnalysisEntry[]>([]);
  const [startAnalysis, setStartAnalysis] = useState<PositionAnalysis | null>(
    null
  );
  const [finalAnalysis, setFinalAnalysis] = useState<PositionAnalysis | null>(
    null
  );

  const runTokenRef = useRef<number>(0);

  const cancelAnalysis = useCallback(() => {
    runTokenRef.current++;
    setIsAnalyzing(false);
  }, []);

  const resetAnalysis = useCallback(() => {
    runTokenRef.current++;
    setIsAnalyzing(false);
    setProgress(0);
    setEntries([]);
    setStartAnalysis(null);
    setFinalAnalysis(null);
  }, []);

  const runFullAnalysis = useCallback((history: HistoryEntry[]) => {
    const token = ++runTokenRef.current;
    setEntries([]);
    setStartAnalysis(null);
    setFinalAnalysis(null);

    if (!history.length) {
      setIsAnalyzing(false);
      setProgress(100);
      return;
    }

    setIsAnalyzing(true);
    setProgress(0);

    // Build all board states along the game
    const states: GameState[] = [createInitialState(10)];
    for (let i = 0; i < history.length; i++) {
      const h = history[i];
      const prev = states[states.length - 1];
      const m = findMatchingLegalMove(prev, h.from, h.to, h.promotion);
      if (!m) break;
      states.push(executeMoveOnState(prev, m, false).nextState);
    }

    const totalPositions = states.length; // history.length + 1
    const posAnalyses: PositionAnalysis[] = [];
    let idx = 0;

    const step = () => {
      if (token !== runTokenRef.current) return;

      const analysis = analyzePosition(states[idx], 2, 18000);
      posAnalyses.push(analysis);

      if (idx === 0) {
        setStartAnalysis(analysis);
      } else {
        const prevAnalysis = posAnalyses[idx - 1];
        const moveEntry = history[idx - 1];
        const mover = states[idx - 1].turn; // 'w' or 'b'

        const bestCp = prevAnalysis.scoreCp;
        const afterCp = analysis.scoreCp;
        // Centipawn loss from mover's perspective (clamped >= 0)
        const rawLoss = mover === 'w' ? bestCp - afterCp : afterCp - bestCp;
        const cpLoss = Math.max(0, Math.round(rawLoss));

        const playedIsBest =
          !!prevAnalysis.bestMove &&
          prevAnalysis.bestMove.from === moveEntry.from &&
          prevAnalysis.bestMove.to === moveEntry.to &&
          (prevAnalysis.bestMove.promotion || null) ===
            (moveEntry.promotion || null);

        const quality = classifyMoveQuality(cpLoss, playedIsBest);

        const newEntry: MoveAnalysisEntry = {
          ply: idx,
          mover,
          playedLabel: formatMoveLabel(
            moveEntry.from,
            moveEntry.to,
            moveEntry.promotion,
            moveEntry.capture
          ),
          playedFrom: moveEntry.from,
          playedTo: moveEntry.to,
          scoreCp: analysis.scoreCp,
          mateIn: analysis.mateIn,
          cpLoss,
          quality,
          bestMoveBefore: prevAnalysis.bestMove,
          topMovesBefore: prevAnalysis.topMoves,
        };

        setEntries((prev) => [...prev, newEntry]);
      }

      if (idx === totalPositions - 1) {
        setFinalAnalysis(analysis);
      }

      idx++;
      setProgress(Math.round((idx / totalPositions) * 100));

      if (idx < totalPositions) {
        window.setTimeout(step, 8);
      } else {
        setIsAnalyzing(false);
      }
    };

    window.setTimeout(step, 10);
  }, []);

  const summary: AnalysisSummary = useMemo(() => {
    const wLosses: number[] = [];
    const bLosses: number[] = [];
    const counts = { w: emptyCounts(), b: emptyCounts() };

    for (const e of entries) {
      counts[e.mover][e.quality]++;
      const cappedLoss = Math.min(e.cpLoss, 600);
      if (e.mover === 'w') wLosses.push(cappedLoss);
      else bLosses.push(cappedLoss);
    }

    return {
      whiteAccuracy: computeAccuracyPercent(wLosses),
      blackAccuracy: computeAccuracyPercent(bLosses),
      counts,
    };
  }, [entries]);

  const getEvalAtPly = useCallback(
    (ply: number): { scoreCp: number; mateIn: number | null } | null => {
      if (ply === 0) {
        return startAnalysis
          ? { scoreCp: startAnalysis.scoreCp, mateIn: startAnalysis.mateIn }
          : null;
      }
      const found = entries[ply - 1];
      if (!found) return null;
      return { scoreCp: found.scoreCp, mateIn: found.mateIn };
    },
    [entries, startAnalysis]
  );

  const getPositionAnalysisAtPly = useCallback(
    (ply: number, currentBoardState: GameState): PositionAnalysis | null => {
      if (ply === 0 && startAnalysis) return startAnalysis;
      if (ply > 0 && entries[ply]) {
        const nextEntry = entries[ply];
        return {
          scoreCp: entries[ply - 1]?.scoreCp ?? 0,
          mateIn: entries[ply - 1]?.mateIn ?? null,
          bestMove: nextEntry.bestMoveBefore,
          topMoves: nextEntry.topMovesBefore,
          depth: 2,
        };
      }
      if (ply === entries.length && finalAnalysis) {
        return finalAnalysis;
      }
      // Compute on demand for single reviewed position if not yet analyzed
      if (currentBoardState) {
        return analyzePosition(currentBoardState, 2, 18000);
      }
      return null;
    },
    [entries, startAnalysis, finalAnalysis]
  );

  return {
    isAnalyzing,
    progress,
    entries,
    summary,
    runFullAnalysis,
    cancelAnalysis,
    resetAnalysis,
    getEvalAtPly,
    getPositionAnalysisAtPly,
  };
}
