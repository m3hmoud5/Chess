import { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, signInWithGoogle, signOutUser } from '../lib/firebase.ts';

export type OnlineAuthMethod = 'none' | 'google' | 'guest';

const GUEST_USERNAME_KEY = 'mahmoud_chess_guest_username';
const GUEST_ACTIVE_KEY = 'mahmoud_chess_guest_active';

function readStoredGuestUsername(): string {
  try {
    return (localStorage.getItem(GUEST_USERNAME_KEY) || '').trim().slice(0, 24);
  } catch {
    return '';
  }
}

function readStoredGuestActive(): boolean {
  try {
    return (
      localStorage.getItem(GUEST_ACTIVE_KEY) === '1' &&
      readStoredGuestUsername().length >= 2
    );
  } catch {
    return false;
  }
}

export function useOnlineAuth() {
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [guestUsername, setGuestUsername] = useState<string>(() =>
    readStoredGuestUsername()
  );
  const [guestActive, setGuestActive] = useState<boolean>(() =>
    readStoredGuestActive()
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setGoogleUser(nextUser);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  const authMethod: OnlineAuthMethod = googleUser
    ? 'google'
    : guestActive && guestUsername.trim().length >= 2
      ? 'guest'
      : 'none';

  const activePlayerName = useMemo(() => {
    if (googleUser) {
      return (
        googleUser.displayName?.trim() ||
        googleUser.email?.split('@')[0]?.trim() ||
        'لاعب Google'
      ).slice(0, 24);
    }
    if (guestActive && guestUsername.trim().length >= 2) {
      return guestUsername.trim().slice(0, 24);
    }
    return '';
  }, [googleUser, guestActive, guestUsername]);

  const loginWithGoogle = useCallback(async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
      setGuestActive(false);
      try {
        localStorage.removeItem(GUEST_ACTIVE_KEY);
      } catch {
        // Ignore storage error
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'تعذر تسجيل الدخول بحساب Google';
      if (msg.includes('popup-closed-by-user')) {
        setAuthError('تم إغلاق نافذة تسجيل الدخول قبل إتمام العملية');
      } else {
        setAuthError(msg);
      }
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const confirmGuest = useCallback((rawName: string): string | null => {
    const clean = rawName.replace(/\s+/g, ' ').trim().slice(0, 24);
    if (clean.length < 2) {
      setAuthError('يجب كتابة اسم مستخدم من حرفين على الأقل للعب كضيف');
      return null;
    }
    setAuthError(null);
    setGuestUsername(clean);
    setGuestActive(true);
    try {
      localStorage.setItem(GUEST_USERNAME_KEY, clean);
      localStorage.setItem(GUEST_ACTIVE_KEY, '1');
    } catch {
      // Ignore storage error
    }
    return clean;
  }, []);

  const switchAccount = useCallback(async () => {
    setAuthError(null);
    setGuestActive(false);
    try {
      localStorage.removeItem(GUEST_ACTIVE_KEY);
    } catch {
      // Ignore storage error
    }
    if (googleUser) {
      setAuthBusy(true);
      try {
        await signOutUser();
      } catch (err) {
        setAuthError(
          err instanceof Error ? err.message : 'تعذر تسجيل الخروج من Google'
        );
      } finally {
        setAuthBusy(false);
      }
    }
  }, [googleUser]);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  return useMemo(
    () => ({
      googleUser,
      authReady,
      authBusy,
      authError,
      authMethod,
      activePlayerName,
      savedGuestUsername: guestUsername,
      loginWithGoogle,
      confirmGuest,
      switchAccount,
      clearAuthError,
    }),
    [
      googleUser,
      authReady,
      authBusy,
      authError,
      authMethod,
      activePlayerName,
      guestUsername,
      loginWithGoogle,
      confirmGuest,
      switchAccount,
      clearAuthError,
    ]
  );
}
