import { destroySession, listSessions, getSession } from './harness-factory.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Maximum idle time before a session is destroyed (2 hours) */
const MAX_IDLE_MS = 2 * 60 * 60 * 1000;

/** How often to check for idle sessions (5 minutes) */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

// ---------------------------------------------------------------------------
// Idle Cleanup
// ---------------------------------------------------------------------------

/**
 * Start the periodic cleanup of idle sessions.
 * E2B's autoPause handles sandbox-level idle detection (pauses after timeout).
 * This manager handles session-level cleanup (destroys sessions after extended idle).
 */
export function startSessionCleanup(): void {
  if (cleanupTimer) return;

  cleanupTimer = setInterval(async () => {
    const now = Date.now();
    const sessions = listSessions();

    for (const session of sessions) {
      const idleMs = now - session.lastActivity;
      if (idleMs > MAX_IDLE_MS) {
        console.log(
          `🗑️ Destroying idle session ${session.threadKey} (idle for ${Math.round(idleMs / 60000)}m)`,
        );
        await destroySession(session.threadKey);
      }
    }
  }, CLEANUP_INTERVAL_MS);
}

/**
 * Stop the periodic cleanup.
 */
export function stopSessionCleanup(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

/**
 * Destroy all active sessions. Call this on server shutdown.
 */
export async function destroyAllSessions(): Promise<void> {
  const sessions = listSessions();
  for (const session of sessions) {
    try {
      await destroySession(session.threadKey);
    } catch {
      // Best-effort cleanup
    }
  }
}

/**
 * Get a summary of active sessions for monitoring.
 */
export function getSessionsSummary(): {
  totalSessions: number;
  sessions: Array<{
    threadKey: string;
    lastActivity: number;
    idleMinutes: number;
  }>;
} {
  const now = Date.now();
  const sessions = listSessions();

  return {
    totalSessions: sessions.length,
    sessions: sessions.map(s => ({
      threadKey: s.threadKey,
      lastActivity: s.lastActivity,
      idleMinutes: Math.round((now - s.lastActivity) / 60000),
    })),
  };
}
