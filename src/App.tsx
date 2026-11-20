import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Cpu,
  Download,
  FlipVertical2,
  Globe,
  Maximize2,
  RotateCcw,
  Save,
  Trash2,
  Undo2,
  Upload,
  Users,
  Volume2,
  VolumeX,
  WifiOff,
  Copy,
  Check,
  LineChart,
} from 'lucide-react';
import { AnalysisPanel } from './components/AnalysisPanel.tsx';
import { ChessBoard, type BoardTheme } from './components/ChessBoard.tsx';
import { ChessPieceSvg } from './components/ChessPieceSvg.tsx';
import { OfflineModal } from './components/OfflineModal.tsx';
import { OnlinePanel } from './components/OnlinePanel.tsx';
import { useChessSound } from './hooks/useChessSound.ts';
import { useGameAnalysis } from './hooks/useGameAnalysis.ts';
import { useOnlineAuth } from './hooks/useOnlineAuth.ts';
import { useOnlineChess } from './hooks/useOnlineChess.ts';
import { useOnlineStatus } from './hooks/useOnlineStatus.ts';
import { usePWAInstall } from './hooks/usePWAInstall.ts';
import {
  createInitialState,
  executeMoveOnState,
  findBestAiMove,
  formatEvalScore,
  getMaterialScore,
  isInCheck,
  parseFenIntoState,
  repetitionKey,
  replayHistoryToPly,
  sqName,
  toFen,
  type GameState,
  type Move,
  type PieceChar,
  type PieceColor,
} from './shared/chessEngine.ts';

type PlayMode = 'online' | 'ai' | 'pvp';

const LOCAL_SAVE_KEY = 'mahmoud_chess_local_save_v2';

function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export default function App() {
  const isOnline = useOnlineStatus();
  const {
    isInstallable,
    isInstalled,
    isIOS,
    swReady,
    installPWA,
    downloadOfflineHtml,
  } = usePWAInstall();

  // Check if URL has ?room=CODE
  const initialRoomCode = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('room')?.trim().toUpperCase() || null;
  }, []);

  const [mode, setMode] = useState<PlayMode>(() => {
    if (initialRoomCode) return 'online';
    return navigator.onLine ? 'online' : 'ai';
  });
  const [aiLevel, setAiLevel] = useState<1 | 2 | 3>(2);
  const [humanAiColor, setHumanAiColor] = useState<PieceColor>('w');
  const [timeMinutes, setTimeMinutes] = useState<number>(10);
  const [theme, setTheme] = useState<BoardTheme>('wood');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [manualFlip, setManualFlip] = useState<boolean>(false);
  const [boardExpanded, setBoardExpanded] = useState<boolean>(false);
  const [offlineModalOpen, setOfflineModalOpen] = useState<boolean>(false);

  const [localGame, setLocalGame] = useState<GameState>(() =>
    createInitialState(10)
  );
  const [aiThinking, setAiThinking] = useState<boolean>(false);
  const [engineStats, setEngineStats] = useState<string>(
    'محرك البحث: Minimax + Alpha-Beta + Quiescence'
  );
  const [toast, setToast] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState<boolean>(false);
  const [fenCopied, setFenCopied] = useState<boolean>(false);
  const [reviewMode, setReviewMode] = useState<boolean>(false);
  const [reviewPly, setReviewPly] = useState<number>(0);
  const [showBestArrow, setShowBestArrow] = useState<boolean>(true);
  const [hoveredCandidateArrow, setHoveredCandidateArrow] = useState<{
    from: string;
    to: string;
  } | null>(null);

  const playSound = useChessSound(soundEnabled);
  const analysis = useGameAnalysis();
  const onlineAuth = useOnlineAuth();
  const toastTimerRef = useRef<number | null>(null);
  const aiTokenRef = useRef<number>(0);
  const joinedInitialRoomRef = useRef<boolean>(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const online = useOnlineChess({
    enabled: mode === 'online',
    isOnline,
    onSound: playSound,
  });

  // Sync authenticated Google display name or confirmed Guest username into online playerName
  useEffect(() => {
    if (onlineAuth.activePlayerName) {
      online.setPlayerName(onlineAuth.activePlayerName);
    }
  }, [onlineAuth.activePlayerName, online.setPlayerName]);

  // Auto-join ?room=CODE only once connected AND user selected Google or created a Guest username
  useEffect(() => {
    if (
      initialRoomCode &&
      !joinedInitialRoomRef.current &&
      mode === 'online' &&
      online.wsStatus === 'connected' &&
      onlineAuth.authMethod !== 'none' &&
      onlineAuth.activePlayerName.length >= 2
    ) {
      joinedInitialRoomRef.current = true;
      online.setPlayerName(onlineAuth.activePlayerName);
      online.joinRoom(initialRoomCode);
    }
  }, [
    initialRoomCode,
    mode,
    online,
    onlineAuth.authMethod,
    onlineAuth.activePlayerName,
  ]);

  // Reset manual flip when entering a new online room as black/white
  useEffect(() => {
    if (mode === 'online' && online.myRole === 'b') {
      setManualFlip(true);
    } else if (mode === 'online' && online.myRole === 'w') {
      setManualFlip(false);
    }
  }, [mode, online.room?.code, online.myRole]);

  // Local Clock Ticker for AI & PvP modes
  useEffect(() => {
    if (
      mode === 'online' ||
      localGame.initialTime === 0 ||
      !localGame.started ||
      localGame.over
    ) {
      return;
    }

    let last = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      const dt = (now - last) / 1000;
      last = now;
      setLocalGame((prev) => {
        if (!prev.started || prev.over || prev.initialTime === 0) return prev;
        const turn = prev.turn;
        const nextClock = Math.max(0, prev.clocks[turn] - dt);
        if (nextClock <= 0) {
          playSound('end');
          return {
            ...prev,
            over: true,
            winner: turn === 'w' ? 'b' : 'w',
            resultText:
              turn === 'w'
                ? 'انتهى وقت الأبيض — الأسود فاز'
                : 'انتهى وقت الأسود — الأبيض فاز',
            clocks: { ...prev.clocks, [turn]: 0 },
          };
        }
        return {
          ...prev,
          clocks: { ...prev.clocks, [turn]: nextClock },
        };
      });
    }, 250);

    return () => window.clearInterval(id);
  }, [
    mode,
    localGame.initialTime,
    localGame.started,
    localGame.over,
    playSound,
  ]);

  // Trigger AI Move when it's AI's turn
  useEffect(() => {
    if (mode !== 'ai' || localGame.over) return;
    const aiColor: PieceColor = humanAiColor === 'w' ? 'b' : 'w';
    if (localGame.turn !== aiColor) return;

    const token = ++aiTokenRef.current;
    setAiThinking(true);
    const snapshot = localGame;

    const timerId = window.setTimeout(() => {
      if (token !== aiTokenRef.current) return;
      const result = findBestAiMove(snapshot, aiLevel);
      if (token !== aiTokenRef.current) return;
      setAiThinking(false);

      if (result.move) {
        const moveToApply: Move = result.move.promotion
          ? { ...result.move, promoted: true }
          : result.move;
        const { nextState, entry } = executeMoveOnState(
          snapshot,
          moveToApply,
          true
        );
        setLocalGame(nextState);
        setEngineStats(
          `العمق: ${result.depth} · العقد المحللة: ${result.nodes.toLocaleString()}`
        );
        if (nextState.over) {
          playSound('end');
        } else if (isInCheck(nextState.b, nextState.turn)) {
          playSound('check');
        } else {
          playSound(entry.capture ? 'capture' : 'move');
        }
      }
    }, 220);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [mode, localGame, aiLevel, humanAiColor, playSound]);

  const startLocalNewGame = useCallback(
    (nextTime = timeMinutes, nextHumanColor = humanAiColor) => {
      aiTokenRef.current++;
      setAiThinking(false);
      setReviewMode(false);
      setReviewPly(0);
      setHoveredCandidateArrow(null);
      analysis.resetAnalysis();
      setLocalGame(createInitialState(nextTime));
      if (mode === 'ai') {
        setManualFlip(nextHumanColor === 'b');
      } else {
        setManualFlip(false);
      }
    },
    [timeMinutes, humanAiColor, mode, analysis]
  );

  const handleModeSwitch = (nextMode: PlayMode) => {
    if (nextMode === mode) return;
    aiTokenRef.current++;
    setAiThinking(false);
    setReviewMode(false);
    setReviewPly(0);
    setHoveredCandidateArrow(null);
    analysis.resetAnalysis();
    setMode(nextMode);
    if (nextMode === 'ai') {
      setManualFlip(humanAiColor === 'b');
    } else if (nextMode === 'pvp') {
      setManualFlip(false);
    }
  };

  const handleMove = useCallback(
    (move: Move) => {
      if (mode === 'online') {
        if (!online.room || online.room.status !== 'playing') return;
        online.sendMove(
          sqName(move.from),
          sqName(move.to),
          move.promotion || null
        );
        return;
      }

      const { nextState, entry } = executeMoveOnState(localGame, move, true);
      setLocalGame(nextState);
      if (nextState.over) {
        playSound('end');
      } else if (isInCheck(nextState.b, nextState.turn)) {
        playSound('check');
      } else {
        playSound(entry.capture ? 'capture' : 'move');
      }
    },
    [mode, online, localGame, playSound]
  );

  const handleUndoLocal = () => {
    if (mode === 'online' || !localGame.history.length) return;
    aiTokenRef.current++;
    setAiThinking(false);

    const steps = mode === 'ai' ? Math.min(2, localGame.history.length) : 1;
    let updated: GameState = JSON.parse(JSON.stringify(localGame));
    for (let i = 0; i < steps; i++) {
      const last = updated.history.pop();
      if (!last?.before) break;
      parseFenIntoState(last.before.fen, updated);
      updated.captured = last.before.captured;
      updated.clocks = last.before.clocks;
      updated.started = last.before.started;
      updated.over = false;
      updated.resultText = null;
      updated.winner = null;
      updated.repetition = last.before.repetition;
    }
    setLocalGame(updated);
  };

  const handleSaveLocal = () => {
    try {
      const payload = {
        fen: toFen(localGame),
        history: localGame.history,
        captured: localGame.captured,
        clocks: localGame.clocks,
        repetition: localGame.repetition,
        initialTime: localGame.initialTime,
        started: localGame.started,
        over: localGame.over,
        resultText: localGame.resultText,
        winner: localGame.winner,
        mode: mode === 'ai' ? 'ai' : 'pvp',
        aiLevel,
        humanAiColor,
        theme,
      };
      localStorage.setItem(LOCAL_SAVE_KEY, JSON.stringify(payload));
      showToast('تم حفظ المباراة على هذا الجهاز');
    } catch {
      showToast('تعذر حفظ المباراة');
    }
  };

  const handleRestoreLocal = () => {
    try {
      const raw = localStorage.getItem(LOCAL_SAVE_KEY);
      if (!raw) {
        showToast('لا توجد مباراة محفوظة');
        return;
      }
      const d = JSON.parse(raw);
      aiTokenRef.current++;
      setAiThinking(false);
      const restored = createInitialState(d.initialTime ?? 10);
      parseFenIntoState(d.fen, restored);
      restored.history = Array.isArray(d.history) ? d.history : [];
      restored.captured = d.captured || { w: [], b: [] };
      restored.clocks = d.clocks || { w: 600, b: 600 };
      restored.repetition = Array.isArray(d.repetition)
        ? d.repetition
        : [repetitionKey(restored)];
      restored.started = !!d.started;
      restored.over = !!d.over;
      restored.resultText = d.resultText || null;
      restored.winner = d.winner || null;

      setMode(d.mode === 'ai' ? 'ai' : 'pvp');
      if (d.aiLevel) setAiLevel(d.aiLevel);
      if (d.humanAiColor) setHumanAiColor(d.humanAiColor);
      if (d.theme) setTheme(d.theme);
      setTimeMinutes(restored.initialTime);
      setLocalGame(restored);
      showToast('تمت استعادة المباراة المحفوظة');
    } catch {
      showToast('تعذر استعادة المباراة');
    }
  };

  const handleResetSave = () => {
    localStorage.removeItem(LOCAL_SAVE_KEY);
    setConfirmReset(false);
    startLocalNewGame();
    showToast('تم مسح الحفظ وبدء مباراة جديدة');
  };

  const activeGameState: GameState =
    mode === 'online' && online.room ? online.room.gameState : localGame;

  // Anti-cheat guard: in online mode, engine analysis & move review are strictly locked until the match is over.
  const isLiveOnlineMatch =
    mode === 'online' && !!online.room && !activeGameState.over;
  const canAnalyzeNow =
    activeGameState.history.length > 0 && !isLiveOnlineMatch;

  // Force-close review/analysis if an online game becomes active
  useEffect(() => {
    if (isLiveOnlineMatch && (reviewMode || analysis.isAnalyzing || analysis.entries.length > 0)) {
      setReviewMode(false);
      setReviewPly(0);
      setHoveredCandidateArrow(null);
      analysis.resetAnalysis();
    }
  }, [isLiveOnlineMatch, reviewMode, analysis]);

  // Reset review/analysis if a new online game starts (e.g. rematch)
  const prevHistoryLenForReviewRef = useRef<number>(0);
  useEffect(() => {
    const len = activeGameState.history.length;
    if (len < prevHistoryLenForReviewRef.current && len === 0) {
      setReviewMode(false);
      setReviewPly(0);
      analysis.resetAnalysis();
    }
    prevHistoryLenForReviewRef.current = len;
  }, [activeGameState.history.length, analysis]);

  const displayedGameState: GameState = useMemo(() => {
    if (!reviewMode) return activeGameState;
    return replayHistoryToPly(
      activeGameState.history,
      reviewPly,
      activeGameState.initialTime
    );
  }, [reviewMode, activeGameState, reviewPly]);

  // Keyboard navigation in review mode
  useEffect(() => {
    if (!reviewMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setReviewPly((p) => Math.max(0, p - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setReviewPly((p) => Math.min(activeGameState.history.length, p + 1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [reviewMode, activeGameState.history.length]);

  const currentPositionAnalysis = useMemo(() => {
    if (!reviewMode || isLiveOnlineMatch) return null;
    return analysis.getPositionAnalysisAtPly(reviewPly, displayedGameState);
  }, [reviewMode, isLiveOnlineMatch, reviewPly, displayedGameState, analysis]);

  const openPostGameAnalysis = useCallback(
    (targetPly?: number, autoAnalyze = true) => {
      if (isLiveOnlineMatch) {
        showToast('التحليل متاح في اللعب أونلاين بعد انتهاء المباراة فقط');
        return;
      }
      const total = activeGameState.history.length;
      setReviewPly(
        typeof targetPly === 'number' ? targetPly : total
      );
      setReviewMode(true);
      if (
        autoAnalyze &&
        total > 0 &&
        !analysis.isAnalyzing &&
        analysis.entries.length !== total
      ) {
        analysis.runFullAnalysis(activeGameState.history);
      }
    },
    [isLiveOnlineMatch, activeGameState.history, analysis, showToast]
  );

  const handleCopyFen = async () => {
    try {
      await navigator.clipboard.writeText(toFen(displayedGameState));
      setFenCopied(true);
      showToast('تم نسخ رمز الوضع (FEN)');
      setTimeout(() => setFenCopied(false), 1800);
    } catch {
      showToast('تعذر نسخ رمز FEN');
    }
  };

  const canInteractColor: PieceColor | 'both' | null = useMemo(() => {
    if (reviewMode) return null;
    if (mode === 'online') {
      if (!online.room || online.room.status !== 'playing') return null;
      if (online.myRole === 'w' || online.myRole === 'b') return online.myRole;
      return null;
    }
    if (mode === 'ai') {
      return aiThinking ? null : humanAiColor;
    }
    return 'both';
  }, [reviewMode, mode, online.room, online.myRole, aiThinking, humanAiColor]);

  const material = useMemo(
    () => getMaterialScore(displayedGameState.captured),
    [displayedGameState.captured]
  );

  // Determine top & bottom player strips based on board orientation (`manualFlip`)
  const topColor: PieceColor = manualFlip ? 'w' : 'b';
  const bottomColor: PieceColor = manualFlip ? 'b' : 'w';

  const getPlayerLabel = (col: PieceColor) => {
    if (mode === 'online' && online.room) {
      const slot = online.room.players[col];
      if (!slot) return col === 'w' ? 'الأبيض (بانتظار)' : 'الأسود (بانتظار)';
      return `${slot.name}${slot.connected ? '' : ' (منقطع)'}`;
    }
    if (mode === 'ai') {
      if (col === humanAiColor) return 'أنت';
      return aiThinking ? 'الكمبيوتر (يفكر...)' : 'الكمبيوتر';
    }
    return col === 'w' ? 'اللاعب الأبيض' : 'اللاعب الأسود';
  };

  const renderPlayerStrip = (col: PieceColor) => {
    const isTurn = !activeGameState.over && activeGameState.turn === col;
    const capturedList: PieceChar[] = activeGameState.captured[col];
    const advantage =
      col === 'w' ? material.wAdvantage : material.bAdvantage;
    const showClock =
      mode === 'online'
        ? (online.room?.timeMinutes ?? 10) > 0
        : activeGameState.initialTime > 0;

    return (
      <div
        className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 transition-colors ${
          isTurn
            ? 'border-[#2bb673]/55 bg-[#192434]'
            : 'border-white/8 bg-[#161e2b]'
        }`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={`inline-block h-3 w-3 shrink-0 rounded-full border ${
                col === 'w'
                  ? 'border-white/40 bg-white'
                  : 'border-white/30 bg-[#181b20]'
              }`}
            />
            <span className="truncate text-sm font-bold text-white">
              {getPlayerLabel(col)}
            </span>
            {isTurn && (
              <span className="text-xs font-bold text-[#2bb673]">
                · دوره الآن
              </span>
            )}
          </div>
          <div className="mt-1 flex min-h-[20px] items-center gap-1.5 text-sm leading-none">
            <span dir="ltr" className="flex flex-wrap items-center gap-0.5">
              {capturedList.map((p, idx) => (
                <ChessPieceSvg
                  key={`${p}-${idx}`}
                  piece={p}
                  className="inline-block h-4 w-4"
                />
              ))}
            </span>
            {advantage > 0 && (
              <span className="font-mono-tabular text-xs font-bold text-[#d4a84b]">
                +{advantage}
              </span>
            )}
          </div>
        </div>

        <div
          dir="ltr"
          className={`font-mono-tabular rounded-lg px-3 py-1.5 text-base font-bold ${
            isTurn
              ? 'bg-[#2bb673] text-[#072115]'
              : 'bg-[#101621] text-[#dce5f2]'
          }`}
        >
          {showClock ? formatClock(activeGameState.clocks[col]) : '∞'}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* 3-Zone Top Bar Contract */}
      <header className="border-b border-white/10 bg-[#121824]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:gap-8 sm:px-6">
          {/* Zone 1: Single-line Brand Wordmark */}
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              handleModeSwitch(isOnline ? 'online' : 'ai');
            }}
            className="text-lg font-extrabold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            محمود شطرنج
          </a>

          {/* Zone 2: Clean single-line mode links */}
          <nav
            aria-label="أوضاع اللعب"
            className="hidden md:flex items-center gap-6 text-sm font-bold"
          >
            <button
              type="button"
              onClick={() => handleModeSwitch('online')}
              className={`transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
                mode === 'online'
                  ? 'border-b-2 border-[#2bb673] text-white'
                  : 'text-[#9aa8bd] hover:text-white'
              }`}
            >
              اللعب أونلاين
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch('ai')}
              className={`transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
                mode === 'ai'
                  ? 'border-b-2 border-[#2bb673] text-white'
                  : 'text-[#9aa8bd] hover:text-white'
              }`}
            >
              ضد الكمبيوتر
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch('pvp')}
              className={`transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
                mode === 'pvp'
                  ? 'border-b-2 border-[#2bb673] text-white'
                  : 'text-[#9aa8bd] hover:text-white'
              }`}
            >
              لاعبان محلياً
            </button>
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setOfflineModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-[#2bb673] px-3.5 py-2 text-xs font-extrabold text-[#072115] transition hover:bg-[#32c87f] whitespace-nowrap shrink-0"
            >
              <Download className="h-4 w-4" />
              <span>تحميل بدون نت</span>
            </button>
          </div>
        </div>

        {/* Mobile Mode Switcher */}
        <div className="flex md:hidden border-t border-white/8 px-3 py-2 gap-1.5">
          <button
            type="button"
            onClick={() => handleModeSwitch('online')}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold whitespace-nowrap ${
              mode === 'online'
                ? 'bg-[#2bb673] text-[#072115]'
                : 'bg-[#1a2333] text-[#cbd5e1]'
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            أونلاين
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitch('ai')}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold whitespace-nowrap ${
              mode === 'ai'
                ? 'bg-[#2bb673] text-[#072115]'
                : 'bg-[#1a2333] text-[#cbd5e1]'
            }`}
          >
            <Cpu className="h-3.5 w-3.5" />
            ضد الكمبيوتر
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitch('pvp')}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold whitespace-nowrap ${
              mode === 'pvp'
                ? 'bg-[#2bb673] text-[#072115]'
                : 'bg-[#1a2333] text-[#cbd5e1]'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            لاعبان
          </button>
        </div>
      </header>

      {/* Main Arena */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:px-6 lg:py-7">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,560px)_minmax(340px,1fr)] lg:items-start">
          {/* Primary Visual Anchor: Board & Player Clocks */}
          <section className="space-y-3">
            {renderPlayerStrip(topColor)}

            <div className="flex items-stretch gap-2">
              {reviewMode && currentPositionAnalysis && (
                <div
                  title="شريط تقييم المحرك"
                  className="flex w-7 shrink-0 flex-col overflow-hidden rounded-lg border border-white/15 bg-[#1a1d24]"
                >
                  {(() => {
                    const mate = currentPositionAnalysis.mateIn;
                    const cp = currentPositionAnalysis.scoreCp;
                    const whiteShare =
                      mate !== null
                        ? mate > 0
                          ? 96
                          : 4
                        : Math.max(
                            5,
                            Math.min(95, 50 + 44 * Math.tanh(cp / 360))
                          );
                    const blackShare = 100 - whiteShare;
                    const topShare = manualFlip ? whiteShare : blackShare;
                    const topBg = manualFlip ? 'bg-[#f2f5fa]' : 'bg-[#1a1d24]';
                    const bottomBg = manualFlip ? 'bg-[#1a1d24]' : 'bg-[#f2f5fa]';
                    const scoreStr = formatEvalScore(cp, mate);
                    return (
                      <>
                        <div
                          style={{ height: `${topShare}%` }}
                          className={`${topBg} flex items-start justify-center pt-1.5 transition-all duration-200`}
                        >
                          {cp < 0 && !manualFlip && (
                            <span className="font-mono-tabular text-[9px] font-extrabold text-[#f2f5fa]">
                              {scoreStr}
                            </span>
                          )}
                          {cp >= 0 && manualFlip && (
                            <span className="font-mono-tabular text-[9px] font-extrabold text-[#14161a]">
                              {scoreStr}
                            </span>
                          )}
                        </div>
                        <div
                          className={`${bottomBg} flex flex-1 items-end justify-center pb-1.5 transition-all duration-200`}
                        >
                          {cp >= 0 && !manualFlip && (
                            <span className="font-mono-tabular text-[9px] font-extrabold text-[#14161a]">
                              {scoreStr}
                            </span>
                          )}
                          {cp < 0 && manualFlip && (
                            <span className="font-mono-tabular text-[9px] font-extrabold text-[#f2f5fa]">
                              {scoreStr}
                            </span>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <ChessBoard
                  gameState={displayedGameState}
                  canInteractColor={canInteractColor}
                  flipped={manualFlip}
                  theme={theme}
                  expanded={boardExpanded}
                  onToggleExpand={setBoardExpanded}
                  onMove={handleMove}
                  bestMoveArrow={
                    reviewMode && showBestArrow && currentPositionAnalysis?.bestMove
                      ? {
                          from: currentPositionAnalysis.bestMove.from,
                          to: currentPositionAnalysis.bestMove.to,
                        }
                      : null
                  }
                  secondaryArrow={reviewMode ? hoveredCandidateArrow : null}
                  hideGameOverModal={reviewMode}
                  onAnalyzeGame={
                    canAnalyzeNow
                      ? () => openPostGameAnalysis(activeGameState.history.length, true)
                      : undefined
                  }
                  onNewGame={
                    mode === 'online'
                      ? online.myRole === 'w' || online.myRole === 'b'
                        ? online.requestRematch
                        : undefined
                      : () => startLocalNewGame()
                  }
                  newGameLabel={
                    mode === 'online' ? 'طلب إعادة المباراة' : 'لعبة جديدة'
                  }
                />
              </div>
            </div>

            {renderPlayerStrip(bottomColor)}
          </section>

          {/* Secondary Column: Analysis, Mode Controls, Toolbar, Move History */}
          <aside className="space-y-4">
            {reviewMode && !isLiveOnlineMatch && (
              <AnalysisPanel
                totalPlies={activeGameState.history.length}
                reviewPly={reviewPly}
                onSelectPly={setReviewPly}
                isAnalyzing={analysis.isAnalyzing}
                progress={analysis.progress}
                entries={analysis.entries}
                summary={analysis.summary}
                currentPositionAnalysis={currentPositionAnalysis}
                showBestArrow={showBestArrow}
                onToggleBestArrow={() => setShowBestArrow((v) => !v)}
                onStartAnalysis={() =>
                  analysis.runFullAnalysis(activeGameState.history)
                }
                onCancelAnalysis={analysis.cancelAnalysis}
                onCloseReview={() => {
                  setReviewMode(false);
                  setHoveredCandidateArrow(null);
                }}
                onHoverCandidate={setHoveredCandidateArrow}
              />
            )}
            {mode === 'online' ? (
              <OnlinePanel
                isOnline={isOnline}
                wsStatus={online.wsStatus}
                playerName={onlineAuth.activePlayerName || online.playerName}
                authReady={onlineAuth.authReady}
                authMethod={onlineAuth.authMethod}
                authBusy={onlineAuth.authBusy}
                authError={onlineAuth.authError}
                googleUser={onlineAuth.googleUser}
                savedGuestUsername={onlineAuth.savedGuestUsername}
                pendingInviteCode={
                  initialRoomCode && !joinedInitialRoomRef.current
                    ? initialRoomCode
                    : null
                }
                onLoginGoogle={onlineAuth.loginWithGoogle}
                onConfirmGuest={(username) => {
                  const confirmed = onlineAuth.confirmGuest(username);
                  if (!confirmed) return false;
                  online.setPlayerName(confirmed);
                  return true;
                }}
                onSwitchAccount={() => {
                  if (online.isSearching) online.leaveMatchmaking();
                  if (online.room) online.leaveRoom();
                  void onlineAuth.switchAccount();
                }}
                onClearAuthError={onlineAuth.clearAuthError}
                onlineCount={online.onlineCount}
                queueCount={online.queueCount}
                openRooms={online.openRooms}
                isSearching={online.isSearching}
                searchingTime={online.searchingTime}
                room={online.room}
                myRole={online.myRole}
                errorMsg={online.errorMsg}
                onClearError={online.clearError}
                onJoinMatchmaking={online.joinMatchmaking}
                onLeaveMatchmaking={online.leaveMatchmaking}
                onCreateRoom={online.createRoom}
                onJoinRoom={online.joinRoom}
                onLeaveRoom={online.leaveRoom}
                onResign={online.resign}
                onOfferDraw={online.offerDraw}
                onRespondDraw={online.respondDraw}
                onRematch={online.requestRematch}
                onSendChat={online.sendChat}
              />
            ) : (
              /* Offline AI / PvP Settings Card */
              <div className="rounded-xl border border-white/10 bg-[#161e2b] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-white">
                    {mode === 'ai'
                      ? 'اللعب ضد الكمبيوتر (يعمل بدون نت)'
                      : 'مباراة لاعبين على نفس الجهاز'}
                  </h2>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {mode === 'ai' && (
                    <>
                      <label className="text-xs text-[#9aa8bd]">
                        مستوى الكمبيوتر
                        <select
                          value={aiLevel}
                          onChange={(e) =>
                            setAiLevel(Number(e.target.value) as 1 | 2 | 3)
                          }
                          className="mt-1 w-full rounded-lg border border-white/12 bg-[#1e2838] px-2.5 py-2 text-xs font-bold text-white"
                        >
                          <option value={1}>سهل</option>
                          <option value={2}>متوسط</option>
                          <option value={3}>صعب</option>
                        </select>
                      </label>

                      <label className="text-xs text-[#9aa8bd]">
                        لونك
                        <select
                          value={humanAiColor}
                          onChange={(e) => {
                            const c = e.target.value as PieceColor;
                            setHumanAiColor(c);
                            startLocalNewGame(timeMinutes, c);
                          }}
                          className="mt-1 w-full rounded-lg border border-white/12 bg-[#1e2838] px-2.5 py-2 text-xs font-bold text-white"
                        >
                          <option value="w">الأبيض ⚪</option>
                          <option value="b">الأسود ⚫</option>
                        </select>
                      </label>
                    </>
                  )}

                  <label className="text-xs text-[#9aa8bd]">
                    وقت المباراة
                    <select
                      value={timeMinutes}
                      onChange={(e) => {
                        const mins = Number(e.target.value);
                        setTimeMinutes(mins);
                        startLocalNewGame(mins, humanAiColor);
                      }}
                      className="mt-1 w-full rounded-lg border border-white/12 bg-[#1e2838] px-2.5 py-2 text-xs font-bold text-white"
                    >
                      <option value={0}>بدون ساعة</option>
                      <option value={3}>3 دقائق</option>
                      <option value={5}>5 دقائق</option>
                      <option value={10}>10 دقائق</option>
                      <option value={15}>15 دقيقة</option>
                    </select>
                  </label>

                  <label className="text-xs text-[#9aa8bd]">
                    شكل الرقعة
                    <select
                      value={theme}
                      onChange={(e) => setTheme(e.target.value as BoardTheme)}
                      className="mt-1 w-full rounded-lg border border-white/12 bg-[#1e2838] px-2.5 py-2 text-xs font-bold text-white"
                    >
                      <option value="wood">خشبي</option>
                      <option value="green">أخضر</option>
                      <option value="blue">أزرق</option>
                    </select>
                  </label>
                </div>

                {/* Offline Game Controls */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => startLocalNewGame()}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#2bb673] px-2.5 py-2 text-xs font-extrabold text-[#072115] transition hover:bg-[#32c87f]"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    جديدة
                  </button>
                  <button
                    type="button"
                    onClick={handleUndoLocal}
                    disabled={!localGame.history.length}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/12 bg-[#1e2838] px-2.5 py-2 text-xs font-bold text-white transition hover:bg-[#273449] disabled:opacity-45"
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                    تراجع
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveLocal}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/12 bg-[#1e2838] px-2.5 py-2 text-xs font-bold text-white transition hover:bg-[#273449]"
                  >
                    <Save className="h-3.5 w-3.5" />
                    حفظ
                  </button>
                  <button
                    type="button"
                    onClick={handleRestoreLocal}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/12 bg-[#1e2838] px-2.5 py-2 text-xs font-bold text-white transition hover:bg-[#273449]"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    استعادة
                  </button>
                  {confirmReset ? (
                    <button
                      type="button"
                      onClick={handleResetSave}
                      className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#dc2626] px-2.5 py-2 text-xs font-bold text-white transition hover:bg-[#ef4444]"
                    >
                      تأكيد مسح الحفظ
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmReset(true)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/10 px-2.5 py-2 text-xs font-bold text-[#fca5a5] transition hover:bg-[#ef4444]/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      مسح
                    </button>
                  )}
                </div>

                {mode === 'ai' && (
                  <div className="pt-1 text-center text-[11px] text-[#9aa8bd] tabular-nums">
                    {engineStats}
                  </div>
                )}
              </div>
            )}

            {/* Shared Board Utilities (Theme, Flip, Sound, Expand, FEN) */}
            <div className="rounded-xl border border-white/10 bg-[#161e2b] p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setManualFlip((f) => !f)}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/12 bg-[#1e2838] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#273449] whitespace-nowrap"
                >
                  <FlipVertical2 className="h-3.5 w-3.5" />
                  قلب الرقعة
                </button>

                <button
                  type="button"
                  onClick={() => setSoundEnabled((s) => !s)}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/12 bg-[#1e2838] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#273449] whitespace-nowrap"
                >
                  {soundEnabled ? (
                    <Volume2 className="h-3.5 w-3.5 text-[#2bb673]" />
                  ) : (
                    <VolumeX className="h-3.5 w-3.5 text-[#9aa8bd]" />
                  )}
                  {soundEnabled ? 'الصوت' : 'صامت'}
                </button>

                <button
                  type="button"
                  onClick={() => setBoardExpanded(true)}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/12 bg-[#1e2838] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#273449] whitespace-nowrap"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                  تكبير
                </button>

                <button
                  type="button"
                  onClick={handleCopyFen}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/12 bg-[#1e2838] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#273449] whitespace-nowrap"
                >
                  {fenCopied ? (
                    <Check className="h-3.5 w-3.5 text-[#2bb673]" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  FEN
                </button>
              </div>

              {mode === 'online' && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#9aa8bd]">
                  <span>شكل الرقعة</span>
                  <div className="flex gap-1.5">
                    {(
                      [
                        ['wood', 'خشبي'],
                        ['green', 'أخضر'],
                        ['blue', 'أزرق'],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setTheme(key)}
                        className={`rounded-md px-2.5 py-1 text-xs font-bold transition ${
                          theme === key
                            ? 'bg-[#2bb673] text-[#072115]'
                            : 'bg-[#1e2838] text-[#cbd5e1] hover:bg-[#273449]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Move History with Engine Evaluations */}
            <div className="rounded-xl border border-white/10 bg-[#161e2b] p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-[#dce5f2]">
                    سجل النقلات
                  </h3>
                  <span className="font-mono-tabular text-[11px] text-[#9aa8bd]">
                    {activeGameState.history.length} نقلة
                  </span>
                </div>

                {canAnalyzeNow ? (
                  <button
                    type="button"
                    onClick={() =>
                      openPostGameAnalysis(
                        reviewMode ? reviewPly : activeGameState.history.length,
                        true
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-md border border-[#d4a84b]/40 bg-[#d4a84b]/15 px-2.5 py-1 text-[11px] font-bold text-[#f2d28b] transition hover:bg-[#d4a84b]/25 whitespace-nowrap"
                  >
                    <LineChart className="h-3 w-3" />
                    {analysis.isAnalyzing
                      ? `تحليل ${analysis.progress}%`
                      : reviewMode
                        ? 'عرض التقييم'
                        : 'تحليل النقلات'}
                  </button>
                ) : isLiveOnlineMatch ? (
                  <span className="text-[11px] text-[#9aa8bd]">
                    التحليل متاح بعد المباراة
                  </span>
                ) : null}
              </div>

              <div
                dir="ltr"
                className="font-mono-tabular h-44 overflow-y-auto rounded-lg bg-[#101621] p-2 text-left text-xs text-[#dce5f2]"
              >
                {activeGameState.history.length === 0 ? (
                  <div className="py-14 text-center font-sans text-[#76859b]">
                    لا توجد نقلات بعد
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {Array.from({
                      length: Math.ceil(activeGameState.history.length / 2),
                    }).map((_, rowIdx) => {
                      const whitePly = rowIdx * 2 + 1;
                      const blackPly = rowIdx * 2 + 2;
                      const whiteMove = activeGameState.history[whitePly - 1];
                      const blackMove = activeGameState.history[blackPly - 1];

                      const renderCell = (
                        m: (typeof activeGameState.history)[number] | undefined,
                        plyNum: number
                      ) => {
                        if (!m) return <span />;
                        const evalEntry = !isLiveOnlineMatch
                          ? analysis.entries[plyNum - 1]
                          : undefined;
                        const isSelected = reviewMode && reviewPly === plyNum;
                        const qColor =
                          evalEntry?.quality === 'blunder'
                            ? 'text-[#ef4444]'
                            : evalEntry?.quality === 'mistake'
                              ? 'text-[#fb923c]'
                              : evalEntry?.quality === 'inaccuracy'
                                ? 'text-[#facc15]'
                                : evalEntry?.quality === 'best'
                                  ? 'text-[#2bb673]'
                                  : 'text-[#9aa8bd]';
                        const qSym =
                          evalEntry?.quality === 'blunder'
                            ? '??'
                            : evalEntry?.quality === 'mistake'
                              ? '?'
                              : evalEntry?.quality === 'inaccuracy'
                                ? '?!'
                                : evalEntry?.quality === 'best'
                                  ? '★'
                                  : '';

                        return (
                          <button
                            type="button"
                            disabled={isLiveOnlineMatch}
                            onClick={() => {
                              if (isLiveOnlineMatch) return;
                              setReviewPly(plyNum);
                              setReviewMode(true);
                            }}
                            className={`flex items-center justify-between gap-1 rounded px-1.5 py-0.5 text-left transition disabled:cursor-default ${
                              isSelected
                                ? 'bg-[#2bb673]/25 text-white ring-1 ring-[#2bb673]/60'
                                : isLiveOnlineMatch
                                  ? 'text-[#dce5f2]'
                                  : 'hover:bg-white/8'
                            }`}
                          >
                            <span className="truncate">
                              {m.from}-{m.to}
                              {m.promotion
                                ? `=${m.promotion.toUpperCase()}`
                                : ''}
                              {m.capture ? '×' : ''}
                              {qSym && (
                                <span className={`ml-1 font-bold ${qColor}`}>
                                  {qSym}
                                </span>
                              )}
                            </span>
                            {evalEntry && (
                              <span
                                className={`shrink-0 text-[10px] font-bold ${
                                  evalEntry.scoreCp >= 0
                                    ? 'text-[#cbd5e1]'
                                    : 'text-[#8997ad]'
                                }`}
                              >
                                {formatEvalScore(
                                  evalEntry.scoreCp,
                                  evalEntry.mateIn
                                )}
                              </span>
                            )}
                          </button>
                        );
                      };

                      return (
                        <div
                          key={rowIdx}
                          className="grid grid-cols-[2rem_1fr_1fr] items-center gap-1"
                        >
                          <span className="text-[#6b7a90]">{rowIdx + 1}.</span>
                          {renderCell(whiteMove, whitePly)}
                          {renderCell(blackMove, blackPly)}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Offline Connectivity Indicator */}
      {!isOnline && (
        <div className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-lg border border-[#d4a84b]/40 bg-[#1a2230] px-3.5 py-2 text-xs font-bold text-[#f2d28b] shadow-lg">
          <WifiOff className="h-4 w-4" />
          <span>وضع عدم الاتصال — اللعب ضد الكمبيوتر ولاعبين يعمل بدون نت</span>
        </div>
      )}

      {/* Non-blocking Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg border border-[#2bb673]/40 bg-[#161e2b] px-4 py-2.5 text-xs font-bold text-white shadow-xl">
          {toast}
        </div>
      )}

      {/* Offline Download / PWA Install Modal */}
      <OfflineModal
        open={offlineModalOpen}
        onClose={() => setOfflineModalOpen(false)}
        isInstallable={isInstallable}
        isInstalled={isInstalled}
        isIOS={isIOS}
        swReady={swReady}
        onInstallPWA={installPWA}
        onDownloadHtml={downloadOfflineHtml}
      />
    </div>
  );
}
