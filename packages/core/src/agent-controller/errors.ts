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
