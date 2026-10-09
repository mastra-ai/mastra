/**
 * Removes the model request/history snapshots that agent `step-start`,
 * `step-finish` and `finish` chunks carry (full prompt, file parts, message
 * history, cumulative steps). Used for copies of chunks that are fanned out to
 * other subscribers, which don't need those fields. Only the given chunk is
 * inspected; callers decide which nested chunks to pass in. Returns the same
 * reference when nothing was removed.
 */
export function stripModelSnapshots<T>(chunk: T): T {
  if (!chunk || typeof chunk !== 'object') return chunk;
  const { type, payload } = chunk as { type?: unknown; payload?: unknown };
  if (!payload || typeof payload !== 'object') return chunk;
  const p = payload as Record<string, unknown>;

  if (type === 'step-start') {
    if (!('request' in p) && !('inputMessages' in p)) return chunk;
    const { request: _request, inputMessages: _inputMessages, ...rest } = p;
    return { ...chunk, payload: rest };
  }

  if (type === 'step-finish' || type === 'finish') {
    let changed = false;
    const next: Record<string, unknown> = { ...p };
    if (p.metadata && typeof p.metadata === 'object' && 'request' in p.metadata) {
      const { request: _request, ...metadata } = p.metadata as Record<string, unknown>;
      next.metadata = metadata;
      changed = true;
    }
    if (p.output && typeof p.output === 'object' && 'steps' in p.output) {
      const { steps: _steps, ...output } = p.output as Record<string, unknown>;
      next.output = output;
      changed = true;
    }
    if ('messages' in p) {
      delete next.messages;
      changed = true;
    }
    return changed ? { ...chunk, payload: next } : chunk;
  }

  return chunk;
}
