import type { MastraDBMessage } from '@mastra/core/agent';

function hasPendingToolCall(message: MastraDBMessage): boolean {
  return (
    message.content.parts?.some(part => part.type === 'tool-invocation' && part.toolInvocation.state === 'call') ??
    false
  );
}

/**
 * Selects the leading run of unobserved messages that is safe to buffer when
 * some candidates still contain incomplete tool calls.
 *
 * Policy: buffer the chronological prefix before the first message containing a
 * `tool-invocation` still in state `call` (client- or provider-executed), but
 * only when the cut is clean. The cut is unsafe — and the whole attempt is
 * deferred — when:
 *
 * - Cursor collision: buffering advances the persisted cursor to
 *   `max(buffered.createdAt) + 1ms`, and later candidate selection requires
 *   `createdAt > cursor`. If a retained message sits at the same or +1ms
 *   timestamp, the cursor would permanently hide it even after its result
 *   arrives.
 * - Split tool exchange: a `toolCallId` appears on both sides of the cut, so
 *   the observer would see half of a tool exchange.
 *
 * When no candidate contains a pending call, the input is returned unchanged.
 * An empty result means "defer this buffering attempt" — callers must skip
 * buffering entirely. Raw message persistence is unaffected and happens
 * elsewhere; the retained suffix becomes eligible again once its tool calls
 * complete.
 */
export function selectSafeBufferPrefix(messages: MastraDBMessage[]): MastraDBMessage[] {
  const chronological = [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const firstPending = chronological.findIndex(hasPendingToolCall);
  if (firstPending === -1) {
    return messages;
  }

  const prefix = chronological.slice(0, firstPending);
  const retained = chronological.slice(firstPending);
  const retainedTime = new Date(retained[0]!.createdAt).getTime();
  const retainedToolIds = new Set(
    retained.flatMap(message =>
      (message.content.parts ?? []).flatMap(part =>
        part.type === 'tool-invocation' ? [part.toolInvocation.toolCallId] : [],
      ),
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
