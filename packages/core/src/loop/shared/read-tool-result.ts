import type { MastraDBMessage, MessageList } from '../../agent/message-list';
import { isSameToolCall, isTerminalToolInvocationState } from '../../agent/message-list/utils/tool-invocation-state';

type ToolInvocationPart = Extract<MastraDBMessage['content']['parts'][number], { type: 'tool-invocation' }>;

const isResolvedToolInvocation = (part: ToolInvocationPart) =>
  part.toolInvocation.state === 'result' || part.toolInvocation.state === 'output-error';

/**
 * Read the tool result a processor wrote for the call currently being resolved.
 *
 * The value is read so processor mutations (e.g. redaction done via
 * `messageList.updateToolInvocation`) can be synced into the downstream
 * tool-result stream chunk (main loop) or the serialized step output (durable
 * loop).
 *
 * Some gateways restart tool-call numbering every step, so a later step can
 * reuse a `toolCallId` an earlier step already finished (#31609). Reading the
 * first resolved invocation with that id would then return the *earlier* call's
 * result, so only the newest invocation describing the call being resolved is
 * read: pass its `args` to tell the occurrences apart. An unresolved newest
 * invocation (the usual state before a processor commits a result) yields
 * `undefined`.
 */
export function readToolResultFromMessageList(messageList: MessageList, toolCallId: string, args?: unknown): unknown {
  const messages: MastraDBMessage[] = messageList.get.all.db();
  let newest: ToolInvocationPart | undefined;
  for (const msg of messages) {
    if (!msg || msg.role !== 'assistant' || !msg.content?.parts) continue;
    for (const part of msg.content.parts) {
      if (part?.type !== 'tool-invocation' || part.toolInvocation?.toolCallId !== toolCallId) continue;
      if (!isSameToolCall(toolCallId, args, part.toolInvocation)) continue;
      newest = part;
    }
  }
  if (!newest || !isResolvedToolInvocation(newest)) return undefined;
  return newest.toolInvocation.result;
}

/**
 * Whether the message list still holds an unresolved call for `toolCallId`, i.e. an
 * occurrence an arriving result can resolve.
 *
 * Call this *before* running `processToolResult`: a processor resolves the occurrence
 * it wrote to, which is exactly what the read-back has to detect. A result whose call
 * was never stored separately (a provider returning call and result in one response)
 * has nothing of its own to sync back, and falling back to an earlier step's finished
 * call with a reused id would overwrite that call's result (#31609).
 */
export function hasPendingToolInvocation(messageList: MessageList, toolCallId: string): boolean {
  const messages: MastraDBMessage[] = messageList.get.all.db();
  for (const msg of messages) {
    if (!msg || msg.role !== 'assistant' || !msg.content?.parts) continue;
    for (const part of msg.content.parts) {
      if (part?.type !== 'tool-invocation' || part.toolInvocation?.toolCallId !== toolCallId) continue;
      if (!isTerminalToolInvocationState(part.toolInvocation.state)) return true;
    }
  }
  return false;
}
