import React, { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Check,
  Copy,
  Flag,
  Handshake,
  LogIn,
  LogOut,
  Plus,
  RotateCcw,
  Search,
  Send,
  UserCheck,
  UserPlus,
  Users,
  WifiOff,
} from 'lucide-react';
import type { OnlineAuthMethod } from '../hooks/useOnlineAuth.ts';
import type { PieceColor } from '../shared/chessEngine.ts';
import type {
  OnlineRoomSnapshot,
  RoomSummary,
} from '../shared/protocol.ts';

interface OnlinePanelProps {
  isOnline: boolean;
  wsStatus: 'disconnected' | 'connecting' | 'connected';
  playerName: string;
  authReady: boolean;
  authMethod: OnlineAuthMethod;
  authBusy: boolean;
  authError: string | null;
  googleUser: User | null;
  savedGuestUsername: string;
  pendingInviteCode?: string | null;
  onLoginGoogle: () => void;
  onConfirmGuest: (username: string) => boolean;
  onSwitchAccount: () => void;
  onClearAuthError: () => void;
  onlineCount: number;
  queueCount: number;
  openRooms: RoomSummary[];
  isSearching: boolean;
  searchingTime: number;
  room: OnlineRoomSnapshot | null;
  myRole: PieceColor | 'spectator' | null;
  errorMsg: string | null;
  onClearError: () => void;
  onJoinMatchmaking: (timeMinutes: number) => void;
  onLeaveMatchmaking: () => void;
  onCreateRoom: (
    timeMinutes: number,
    preferredColor: 'random' | PieceColor,
    isPublic: boolean
  ) => void;
  onJoinRoom: (code: string) => void;
  onLeaveRoom: () => void;
  onResign: () => void;
  onOfferDraw: () => void;
  onRespondDraw: (accept: boolean) => void;
  onRematch: () => void;
  onSendChat: (text: string) => void;
}

const TIME_OPTIONS = [
  { value: 3, label: '3 دقائق' },
  { value: 5, label: '5 دقائق' },
  { value: 10, label: '10 دقائق' },
  { value: 15, label: '15 دقيقة' },
];

export const OnlinePanel: React.FC<OnlinePanelProps> = ({
  isOnline,
  wsStatus,
  playerName,
  authReady,
  authMethod,
  authBusy,
  authError,
  googleUser,
  savedGuestUsername,
  pendingInviteCode,
  onLoginGoogle,
  onConfirmGuest,
  onSwitchAccount,
  onClearAuthError,
  onlineCount,
  queueCount,
  openRooms,
  isSearching,
  searchingTime,
  room,
  myRole,
  errorMsg,
  onClearError,
  onJoinMatchmaking,
  onLeaveMatchmaking,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onResign,
  onOfferDraw,
  onRespondDraw,
  onRematch,
  onSendChat,
}) => {
  const [selectedTime, setSelectedTime] = useState<number>(10);
  const [preferredColor, setPreferredColor] = useState<'random' | PieceColor>(
    'random'
  );
  const [isPublicRoom, setIsPublicRoom] = useState<boolean>(true);
  const [joinCode, setJoinCode] = useState<string>('');
  const [copiedType, setCopiedType] = useState<'code' | 'link' | null>(null);
  const [confirmResign, setConfirmResign] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [guestNameInput, setGuestNameInput] = useState<string>(
    () => savedGuestUsername
  );
  const [localGuestError, setLocalGuestError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (savedGuestUsername && !guestNameInput) {
      setGuestNameInput(savedGuestUsername);
    }
  }, [savedGuestUsername, guestNameInput]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [room?.chat.length]);

  useEffect(() => {
    setConfirmResign(false);
  }, [room?.code, room?.status]);

  if (!isOnline) {
    return (
      <div className="rounded-xl border border-white/10 bg-[#161e2b] p-5 text-center">
        <WifiOff className="mx-auto h-8 w-8 text-[#d4a84b]" />
        <h3 className="mt-3 text-base font-bold text-white">
          أنت غير متصل بالإنترنت حالياً
        </h3>
        <p className="mt-1.5 text-xs leading-relaxed text-[#9aa8bd]">
          اللعب المباشر عبر الإنترنت يتطلب اتصالاً بالشبكة. يمكنك اللعب الآن ضد الكمبيوتر أو مع صديق على نفس الجهاز بدون إنترنت.
        </p>
      </div>
    );
  }

  const copyText = async (value: string, kind: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedType(kind);
      setTimeout(() => setCopiedType(null), 1800);
    } catch {
      // Fallback ignored
    }
  };

  if (room) {
    const inviteUrl = `${window.location.origin}/?room=${room.code}`;
    const isPlayer = myRole === 'w' || myRole === 'b';
    const opponentColor: PieceColor | null =
      myRole === 'w' ? 'b' : myRole === 'b' ? 'w' : null;
    const incomingDraw =
      isPlayer &&
      room.status === 'playing' &&
      room.drawOfferBy !== null &&
      room.drawOfferBy === opponentColor;
    const myDrawPending =
      isPlayer && room.status === 'playing' && room.drawOfferBy === myRole;
    const myRematchVoted =
      isPlayer &&
      ((myRole === 'w' && room.rematchVotes.w) ||
        (myRole === 'b' && room.rematchVotes.b));

    return (
      <div className="space-y-3">
        {/* Room Header & Invite */}
        <div className="rounded-xl border border-white/10 bg-[#161e2b] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs text-[#9aa8bd]">
                غرفة اللعب المباشر ·{' '}
                {room.status === 'waiting'
                  ? 'بانتظار منافس'
                  : room.status === 'playing'
                    ? 'مباراة جارية'
                    : 'انتهت المباراة'}
              </div>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="font-mono-tabular text-lg font-bold tracking-wider text-[#2bb673]">
                  {room.code}
                </span>
                <span className="text-xs text-[#9aa8bd]">
                  {myRole === 'w'
                    ? 'أنت تلعب بالأبيض'
                    : myRole === 'b'
                      ? 'أنت تلعب بالأسود'
                      : 'وضع المشاهدة'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => copyText(room.code, 'code')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-[#1e2838] px-2.5 py-1.5 text-xs font-bold text-[#dce5f2] transition hover:bg-[#273449] whitespace-nowrap"
              >
                {copiedType === 'code' ? (
                  <Check className="h-3.5 w-3.5 text-[#2bb673]" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                الكود
              </button>
              <button
                type="button"
                onClick={() => copyText(inviteUrl, 'link')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#2bb673]/30 bg-[#2bb673]/15 px-2.5 py-1.5 text-xs font-bold text-[#6ae3aa] transition hover:bg-[#2bb673]/25 whitespace-nowrap"
              >
                {copiedType === 'link' ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                رابط الدعوة
              </button>
            </div>
          </div>

          {room.status === 'waiting' && (
            <div className="mt-3 rounded-lg bg-[#111722] p-3 text-xs leading-relaxed text-[#dce5f2]">
              شارك كود الغرفة <strong className="font-mono-tabular text-[#2bb673]">{room.code}</strong> أو رابط الدعوة مع منافسك لتبدأ المباراة فوراً.
            </div>
          )}

          {incomingDraw && (
            <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-[#d4a84b]/40 bg-[#d4a84b]/10 p-3">
              <span className="text-xs font-bold text-[#f2d28b]">
                عرض عليك المنافس التعادل
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onRespondDraw(true)}
                  className="rounded-md bg-[#2bb673] px-3 py-1.5 text-xs font-bold text-[#072115] transition hover:bg-[#32c87f]"
                >
                  قبول
                </button>
                <button
                  type="button"
                  onClick={() => onRespondDraw(false)}
                  className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/20"
                >
                  رفض
                </button>
              </div>
            </div>
          )}

          {/* Active Game Actions */}
          <div className="mt-3 flex flex-wrap gap-2">
            {isPlayer && room.status === 'playing' && (
              <>
                <button
                  type="button"
                  onClick={onOfferDraw}
                  disabled={myDrawPending}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/12 bg-[#1e2838] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#273449] disabled:opacity-50 whitespace-nowrap"
                >
                  <Handshake className="h-4 w-4 text-[#d4a84b]" />
                  {myDrawPending ? 'تم إرسال العرض' : 'عرض تعادل'}
                </button>

                {confirmResign ? (
                  <div className="flex flex-1 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        onResign();
                        setConfirmResign(false);
                      }}
                      className="flex-1 rounded-lg bg-[#dc2626] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#ef4444] whitespace-nowrap"
                    >
                      تأكيد الاستسلام
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmResign(false)}
                      className="rounded-lg bg-white/10 px-2.5 py-2 text-xs font-bold text-white hover:bg-white/20"
                    >
                      إلغاء
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmResign(true)}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/10 px-3 py-2 text-xs font-bold text-[#fca5a5] transition hover:bg-[#ef4444]/20 whitespace-nowrap"
                  >
                    <Flag className="h-4 w-4" />
                    استسلام
                  </button>
                )}
              </>
            )}

            {isPlayer && room.status === 'finished' && (
              <button
                type="button"
                onClick={onRematch}
                disabled={myRematchVoted}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#2bb673] px-3 py-2 text-xs font-bold text-[#072115] transition hover:bg-[#32c87f] disabled:opacity-60 whitespace-nowrap"
              >
                <RotateCcw className="h-4 w-4" />
                {myRematchVoted ? 'بانتظار موافقة المنافس...' : 'إعادة المباراة'}
              </button>
            )}

            <button
              type="button"
              onClick={onLeaveRoom}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/12 bg-[#1e2838] px-3 py-2 text-xs font-bold text-[#cbd5e1] transition hover:bg-[#273449] whitespace-nowrap"
            >
              <LogOut className="h-4 w-4" />
              مغادرة
            </button>
          </div>
        </div>

        {/* Live Match Chat */}
        <div className="rounded-xl border border-white/10 bg-[#161e2b] p-4">
          <div className="mb-2 flex items-center justify-between text-xs font-bold text-[#dce5f2]">
            <span>محادثة المباراة</span>
            {room.spectatorsCount > 0 && (
              <span className="text-[#9aa8bd] tabular-nums">
                {room.spectatorsCount} مشاهد
              </span>
            )}
          </div>

          <div className="h-36 space-y-1.5 overflow-y-auto rounded-lg bg-[#101621] p-2.5 text-xs">
            {room.chat.length === 0 ? (
              <div className="py-8 text-center text-[#76859b]">
                لا توجد رسائل بعد
              </div>
            ) : (
              room.chat.map((c) => (
                <div key={c.id} className="leading-relaxed">
                  {c.senderRole === 'system' ? (
                    <span className="text-[#d4a84b]">• {c.text}</span>
                  ) : (
                    <>
                      <span
                        className={`font-bold ${
                          c.senderRole === 'w'
                            ? 'text-[#f2f5fa]'
                            : c.senderRole === 'b'
                              ? 'text-[#6ae3aa]'
                              : 'text-[#9aa8bd]'
                        }`}
                      >
                        {c.senderName}:{' '}
                      </span>
                      <span className="text-[#dce5f2]">{c.text}</span>
                    </>
                  )}
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {['بالتوفيق!', 'نقلة جميلة', 'شكراً على المباراة'].map((phrase) => (
              <button
                key={phrase}
                type="button"
                onClick={() => onSendChat(phrase)}
                className="rounded-md border border-white/10 bg-[#1e2838] px-2 py-1 text-[11px] text-[#cbd5e1] transition hover:bg-[#273449]"
              >
                {phrase}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!chatInput.trim()) return;
              onSendChat(chatInput);
              setChatInput('');
            }}
            className="mt-2 flex gap-2"
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="اكتب رسالة للمنافس..."
              maxLength={280}
              className="min-w-0 flex-1 rounded-lg border border-white/12 bg-[#101621] px-3 py-2 text-xs text-white placeholder-[#6b7a90] focus:border-[#2bb673] focus:outline-none"
            />
            <button
              type="submit"
              aria-label="إرسال"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#2bb673] text-[#072115] transition hover:bg-[#32c87f]"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  const connectionHeader = (
    <div className="flex items-center justify-between gap-2 text-xs text-[#9aa8bd]">
      <span className="flex items-center gap-1.5 font-semibold">
        <Users className="h-3.5 w-3.5 text-[#2bb673]" />
        <span className="tabular-nums">{onlineCount} متصل الآن</span>
        {queueCount > 0 && (
          <>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{queueCount} في البحث</span>
          </>
        )}
      </span>
      <span>
        {wsStatus === 'connected'
          ? 'الخادم متصل'
          : wsStatus === 'connecting'
            ? 'جاري الاتصال...'
            : 'إعادة الاتصال...'}
      </span>
    </div>
  );

  // Identity Gate: Must choose Google or create a Guest username before playing online
  if (authMethod === 'none') {
    const displayedAuthError = localGuestError || authError;

    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-white/10 bg-[#161e2b] p-4 space-y-4">
          {connectionHeader}

          <div>
            <h3 className="text-sm font-extrabold text-white">
              الدخول للعب أونلاين
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-[#9aa8bd]">
              اختر الدخول بحساب Google أو اللعب كضيف مع إنشاء اسم مستخدم خاص بك لبدء اللعب المباشر.
            </p>
          </div>

          {pendingInviteCode && (
            <div className="rounded-lg border border-[#d4a84b]/40 bg-[#d4a84b]/10 px-3 py-2 text-xs text-[#f2d28b]">
              أنت مدعو للانضمام إلى الغرفة{' '}
              <strong className="font-mono-tabular">{pendingInviteCode}</strong>.
              اختر طريقة الدخول للمتابعة.
            </div>
          )}

          {displayedAuthError && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-[#ef4444]/40 bg-[#ef4444]/10 px-3 py-2 text-xs text-[#fca5a5]">
              <span>{displayedAuthError}</span>
              <button
                type="button"
                onClick={() => {
                  setLocalGuestError(null);
                  onClearAuthError();
                }}
                className="font-bold underline shrink-0"
              >
                إخفاء
              </button>
            </div>
          )}

          {!authReady ? (
            <div className="rounded-lg bg-[#101621] py-5 text-center text-xs text-[#9aa8bd]">
              جاري التحقق من حالة الحساب...
            </div>
          ) : (
            <div className="space-y-3.5">
              {/* Option 1: Google Sign-In */}
              <button
                type="button"
                disabled={authBusy}
                onClick={() => {
                  setLocalGuestError(null);
                  onLoginGoogle();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#2bb673] px-4 py-2.5 text-sm font-extrabold text-[#072115] transition hover:bg-[#32c87f] disabled:opacity-55"
              >
                <LogIn className="h-4 w-4" />
                {authBusy ? 'جاري تسجيل الدخول...' : 'الدخول بحساب Google'}
              </button>

              <div className="flex items-center gap-3 text-[11px] font-bold text-[#76859b]">
                <div className="h-px flex-1 bg-white/10" />
                <span>أو اللعب كضيف</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              {/* Option 2: Guest with Required Username */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const clean = guestNameInput.replace(/\s+/g, ' ').trim();
                  if (clean.length < 2) {
                    setLocalGuestError(
                      'يجب عمل اسم مستخدم مكوّن من حرفين على الأقل للعب كضيف'
                    );
                    return;
                  }
                  setLocalGuestError(null);
                  onConfirmGuest(clean);
                }}
                className="rounded-lg border border-white/10 bg-[#101621] p-3.5 space-y-2.5"
              >
                <label className="block text-xs font-bold text-[#dce5f2]">
                  اسم المستخدم (مطلوب للضيف)
                  <input
                    type="text"
                    value={guestNameInput}
                    maxLength={24}
                    onChange={(e) => {
                      setGuestNameInput(e.target.value);
                      if (localGuestError) setLocalGuestError(null);
                    }}
                    placeholder="اكتب اسم المستخدم هنا..."
                    className="mt-1.5 w-full rounded-lg border border-white/12 bg-[#161e2b] px-3 py-2 text-sm font-semibold text-white placeholder-[#6b7a90] focus:border-[#d4a84b] focus:outline-none"
                  />
                </label>

                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#d4a84b]/40 bg-[#d4a84b]/15 px-4 py-2 text-xs font-extrabold text-[#f2d28b] transition hover:bg-[#d4a84b]/25"
                >
                  <UserPlus className="h-4 w-4" />
                  إنشاء اسم المستخدم والدخول كضيف
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Connection & Authenticated Player Identity Header */}
      <div className="rounded-xl border border-white/10 bg-[#161e2b] p-4 space-y-3">
        {connectionHeader}

        <div className="flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-[#101621] px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <UserCheck
                className={`h-4 w-4 shrink-0 ${
                  authMethod === 'google'
                    ? 'text-[#2bb673]'
                    : 'text-[#d4a84b]'
                }`}
              />
              <span className="truncate text-sm font-extrabold text-white">
                {playerName}
              </span>
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                  authMethod === 'google'
                    ? 'bg-[#2bb673]/15 text-[#6ae3aa]'
                    : 'bg-[#d4a84b]/15 text-[#f2d28b]'
                }`}
              >
                {authMethod === 'google' ? 'Google' : 'ضيف'}
              </span>
            </div>
            {authMethod === 'google' && googleUser?.email && (
              <div className="mt-0.5 truncate text-[11px] text-[#76859b]">
                {googleUser.email}
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={authBusy}
            onClick={onSwitchAccount}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-white/10 bg-[#182130] px-2.5 py-1.5 text-[11px] font-bold text-[#cbd5e1] transition hover:bg-[#222e42] hover:text-white disabled:opacity-50"
          >
            <LogOut className="h-3 w-3" />
            {authMethod === 'google' ? 'خروج' : 'تغيير الحساب'}
          </button>
        </div>

        {(errorMsg || authError) && (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-[#ef4444]/40 bg-[#ef4444]/10 px-3 py-2 text-xs text-[#fca5a5]">
            <span>{errorMsg || authError}</span>
            <button
              type="button"
              onClick={() => {
                onClearError();
                onClearAuthError();
              }}
              className="font-bold underline"
            >
              إخفاء
            </button>
          </div>
        )}
      </div>

      {/* Quick Matchmaking */}
      <div className="rounded-xl border border-white/10 bg-[#161e2b] p-4">
        <h3 className="text-sm font-bold text-white">بحث عن منافس مباشر</h3>
        <p className="mt-0.5 text-xs text-[#9aa8bd]">
          اختر وقت المباراة وابدأ اللعب فور توفر منافس عبر الإنترنت
        </p>

        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {TIME_OPTIONS.map((t) => (
            <button
              key={t.value}
              type="button"
              disabled={isSearching}
              onClick={() => setSelectedTime(t.value)}
              className={`rounded-lg border px-2 py-2 text-xs font-bold transition ${
                selectedTime === t.value
                  ? 'border-[#2bb673] bg-[#2bb673]/15 text-[#6ae3aa]'
                  : 'border-white/10 bg-[#1c2636] text-[#cbd5e1] hover:bg-[#232f42]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {isSearching ? (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-[#2bb673]/30 bg-[#2bb673]/10 p-3">
            <div className="text-xs font-bold text-[#6ae3aa]">
              جاري البحث عن منافس ({searchingTime} دقائق)...
            </div>
            <button
              type="button"
              onClick={onLeaveMatchmaking}
              className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/20 whitespace-nowrap"
            >
              إلغاء البحث
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={wsStatus !== 'connected'}
            onClick={() => onJoinMatchmaking(selectedTime)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#2bb673] px-4 py-2.5 text-sm font-bold text-[#072115] transition hover:bg-[#32c87f] disabled:opacity-50"
          >
            <Search className="h-4 w-4" />
            بدء مباراة سريعة أونلاين
          </button>
        )}
      </div>

      {/* Create or Join Private Room */}
      <div className="rounded-xl border border-white/10 bg-[#161e2b] p-4 space-y-3">
        <h3 className="text-sm font-bold text-white">اللعب مع صديق بغرفة</h3>

        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-[#9aa8bd]">
            لونك المفضل
            <select
              value={preferredColor}
              onChange={(e) =>
                setPreferredColor(e.target.value as 'random' | PieceColor)
              }
              className="mt-1 w-full rounded-lg border border-white/12 bg-[#1e2838] px-2.5 py-2 text-xs font-bold text-white"
            >
              <option value="random">عشوائي</option>
              <option value="w">الأبيض ⚪</option>
              <option value="b">الأسود ⚫</option>
            </select>
          </label>

          <label className="text-xs text-[#9aa8bd]">
            خصوصية الغرفة
            <select
              value={isPublicRoom ? 'public' : 'private'}
              onChange={(e) => setIsPublicRoom(e.target.value === 'public')}
              className="mt-1 w-full rounded-lg border border-white/12 bg-[#1e2838] px-2.5 py-2 text-xs font-bold text-white"
            >
              <option value="public">مفتوحة بالردهة</option>
              <option value="private">خاصة بالكود فقط</option>
            </select>
          </label>
        </div>

        <button
          type="button"
          disabled={wsStatus !== 'connected'}
          onClick={() =>
            onCreateRoom(selectedTime, preferredColor, isPublicRoom)
          }
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-[#1e2838] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#273449] disabled:opacity-50"
        >
          <Plus className="h-4 w-4 text-[#2bb673]" />
          إنشاء غرفة جديدة والحصول على كود
        </button>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onJoinRoom(joinCode);
          }}
          className="flex gap-2 pt-1"
        >
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="كود الغرفة (مثال: A7K2P9)"
            maxLength={8}
            dir="ltr"
            className="font-mono-tabular min-w-0 flex-1 rounded-lg border border-white/12 bg-[#101621] px-3 py-2 text-center text-xs font-bold tracking-widest text-white placeholder-[#6b7a90] focus:border-[#2bb673] focus:outline-none"
          />
          <button
            type="submit"
            disabled={wsStatus !== 'connected' || !joinCode.trim()}
            className="rounded-lg bg-[#d4a84b] px-4 py-2 text-xs font-bold text-[#1d1404] transition hover:bg-[#e1b860] disabled:opacity-50 whitespace-nowrap"
          >
            انضمام
          </button>
        </form>
      </div>

      {/* Public Open Rooms */}
      {openRooms.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-[#161e2b] p-4">
          <div className="mb-2 text-xs font-bold text-[#dce5f2]">
            طاولات مفتوحة بانتظار منافس
          </div>
          <div className="space-y-2">
            {openRooms.map((r) => (
              <div
                key={r.code}
                className="flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-[#101621] px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-xs font-bold text-white">
                    {r.hostName}
                  </div>
                  <div className="text-[11px] text-[#9aa8bd] tabular-nums">
                    {r.timeMinutes === 0 ? 'بدون ساعة' : `${r.timeMinutes} دقائق`}{' '}
                    · <span className="font-mono-tabular">{r.code}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onJoinRoom(r.code)}
                  className="rounded-lg bg-[#2bb673] px-3 py-1.5 text-xs font-bold text-[#072115] transition hover:bg-[#32c87f] whitespace-nowrap"
                >
                  تحدي
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
