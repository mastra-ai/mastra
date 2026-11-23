/** The session was aborted or switched before a pending prompt could start. */
export class SessionStartupCancelledError extends Error {
  readonly code = 'SESSION_STARTUP_CANCELLED';

  constructor() {
    super('Session startup cancelled');
    this.name = 'AbortError';
  }
}

/** Distinguish session cancellation from provider and transport AbortErrors. */
export function isSessionStartupCancelledError(error: unknown): error is SessionStartupCancelledError {
  return error instanceof Error && 'code' in error && error.code === 'SESSION_STARTUP_CANCELLED';
}

/** A caller asked to resume a session that was never started and has no stored thread to recover from. */
export class SessionNotStartedError extends Error {
  readonly code = 'SESSION_NOT_STARTED';

  constructor(resourceId: string) {
    super(`No session has been started for resource "${resourceId}"`);
    this.name = 'SessionNotStartedError';
  }
}

export function isSessionNotStartedError(error: unknown): error is SessionNotStartedError {
  return error instanceof Error && 'code' in error && error.code === 'SESSION_NOT_STARTED';
}
