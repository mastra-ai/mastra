import type { MastraDBMessage } from '@mastra/core/agent';

function hasPendingToolCall(message: MastraDBMessage): boolean {
  return (
    message.content.parts?.some(part => part.type === 'tool-invocation' && part.toolInvocation.state === 'call') ??
    false
  );
}

/**
 * Selects the unobserved messages that are safe to buffer while a tool call
 * may still be in flight.
 *
 * Only the chronologically last candidate can hold a live pending call: a
 * `tool-invocation` still in state `call` (client- or provider-executed) on the
 * newest message means the request ended waiting for its result. Any earlier
 * `call` is an orphan — the conversation already continued past it, and core's
 * output converter drops or placeholder-pairs it before the prompt reaches a
 * provider — so it is buffered like any other message.
 *
 * When the last candidate is pending, the prefix before it is buffered, but only
 * when the cut is clean. The cut is unsafe — and the whole attempt is deferred —
 * when:
 *
 * - Cursor collision: buffering advances the persisted cursor to
 *   `max(buffered.createdAt) + 1ms`, and later candidate selection requires
 *   `createdAt > cursor`. If the retained message sits at the same or +1ms
 *   timestamp, the cursor would permanently hide it even after its result
 *   arrives.
 * - Split tool exchange: a `toolCallId` appears on both sides of the cut, so
 *   the observer would see half of a tool exchange.
 *
 * The result is always in chronological order. When the last candidate has no
 * pending call, every message is returned. An empty result means "defer this
 * buffering attempt" — callers must skip buffering entirely. Raw message
 * persistence is unaffected and happens elsewhere; the retained message becomes
 * eligible again once its tool call completes.
 */
export function selectSafeBufferPrefix(messages: MastraDBMessage[]): MastraDBMessage[] {
  const chronological = [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const last = chronological[chronological.length - 1];
  if (!last || !hasPendingToolCall(last)) {
    return chronological;
  }

  const prefix = chronological.slice(0, -1);
  const retainedTime = new Date(last.createdAt).getTime();
  const retainedToolIds = new Set(
    (last.content.parts ?? []).flatMap(part =>
      part.type === 'tool-invocation' ? [part.toolInvocation.toolCallId] : [],
    ),
  );

  const unsafeBoundary = prefix.some(
    message =>
      new Date(message.createdAt).getTime() + 1 >= retainedTime ||
      message.content.parts?.some(
        part => part.type === 'tool-invocation' && retainedToolIds.has(part.toolInvocation.toolCallId),
      ),
  );

  return unsafeBoundary ? [] : prefix;
}
