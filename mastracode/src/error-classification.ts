/**
 * Checks whether an error is an ERR_STREAM_DESTROYED error, which is a
 * non-fatal condition that occurs when code writes to a stream after it
 * has been closed (e.g., client disconnect, cancelled LLM stream, LSP
 * shutdown, killed subprocess).
 *
 * Walks the `.cause` chain up to a depth limit.
 */
export function isStreamDestroyedError(err: unknown, depth = 0): boolean {
  if (!err || depth > 5) return false;
  const e = err as any;
  if (e.code === 'ERR_STREAM_DESTROYED') return true;
  if (typeof e.message === 'string' && e.message.includes('stream was destroyed')) return true;
  if (e.cause && isStreamDestroyedError(e.cause, depth + 1)) return true;
  if (Array.isArray(e.errors) && e.errors.some((inner: unknown) => isStreamDestroyedError(inner, depth + 1)))
    return true;
  return false;
}
