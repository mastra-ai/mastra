/** Keep the session failure primary, including its ACP code, when cleanup also fails. */
export function withCleanupFailure(error: unknown, cleanupError: unknown): unknown {
  if (error instanceof Error) {
    error.cause = new AggregateError(
      error.cause === undefined ? [cleanupError] : [error.cause, cleanupError],
      'ACP session cleanup also failed',
    );
    return error;
  }
  const message =
    error !== null && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
      ? error.message
      : String(error);
  return new AggregateError([error, cleanupError], message, { cause: error });
}
