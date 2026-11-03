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

const PROGRESS_WRAPPER_TYPES = new Set(['tool-output', 'workflow-step-output']);

/**
 * Removes model request/history snapshots from agent chunks before a progress
 * chunk is published to pubsub. Nested agent chunks arrive wrapped in
 * `tool-output` / `workflow-step-output` payloads, so only those wrappers are
 * unwrapped, and only agent-origin chunks are stripped — data a tool writes
 * itself (`from: 'USER'`) is published as-is.
 */
export function slimProgressChunk<T>(chunk: T, depth = 0): T {
  if (!chunk || typeof chunk !== 'object') return chunk;
  const { type, from, payload } = chunk as { type?: unknown; from?: unknown; payload?: unknown };

  if (typeof type === 'string' && PROGRESS_WRAPPER_TYPES.has(type) && payload && typeof payload === 'object') {
    const p = payload as Record<string, unknown>;
    const inner = p.output as { type?: unknown; from?: unknown } | undefined;
    const isNestedChunk =
      !!inner &&
      typeof inner === 'object' &&
      typeof inner.type === 'string' &&
      (inner.from === 'AGENT' || PROGRESS_WRAPPER_TYPES.has(inner.type));
    if (!isNestedChunk) return chunk;
    // Past the nesting limit, drop the nested chunk rather than publish it unslimmed.
    if (depth >= 20) {
      const { output: _output, ...rest } = p;
      return { ...chunk, payload: rest };
    }
    const output = slimProgressChunk(inner, depth + 1);
    return output === inner ? chunk : { ...chunk, payload: { ...p, output } };
  }

  return from === 'AGENT' ? stripModelSnapshots(chunk) : chunk;
}

/**
 * Strips model snapshots only from agent chunks nested inside
 * `tool-output` / `workflow-step-output` wrappers (e.g. chunks forwarded from
 * a delegated sub-agent); top-level chunks are returned unchanged. Returns the
 * same reference when nothing was removed.
 */
export function stripNestedModelSnapshots<T>(chunk: T): T {
  if (!chunk || typeof chunk !== 'object') return chunk;
  const { type } = chunk as { type?: unknown };
  return typeof type === 'string' && PROGRESS_WRAPPER_TYPES.has(type) ? slimProgressChunk(chunk) : chunk;
}
