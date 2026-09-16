import { useCallback, useEffect, useState } from "react";
import { clearSession, currentSession, type SupportSession } from "./api";

/** Keeps a route bound to the token it mounted with until that token expires. */
export function useMountedSession() {
  const [session, setSession] = useState<SupportSession | undefined>(() =>
    currentSession(),
  );
  const invalidateSession = useCallback((expiredSession: SupportSession) => {
    clearSession(expiredSession);
    setSession((mountedSession) =>
      mountedSession?.token === expiredSession.token
        ? undefined
        : mountedSession,
    );
  }, []);

  useEffect(() => {
    if (!session) return;
    const expiry = Date.parse(session.expiresAt);
    const delay = expiry - Date.now();
    if (!Number.isFinite(delay) || delay <= 0) {
      invalidateSession(session);
      return;
    }
    const timeout = window.setTimeout(() => invalidateSession(session), delay);
    return () => window.clearTimeout(timeout);
  }, [invalidateSession, session]);

  return { session, setSession, invalidateSession };
}
