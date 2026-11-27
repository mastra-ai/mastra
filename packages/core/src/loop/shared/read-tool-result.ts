import type { MastraDBMessage, MessageList } from '../../agent/message-list';

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
 * result. Only the newest invocation for the id can belong to the call being
 * resolved, so the newest one is returned and an unresolved newest invocation
 * (the usual state before a processor commits a result) yields `undefined`.
 */
export function readToolResultFromMessageList(messageList: MessageList, toolCallId: string): unknown {
  const messages: MastraDBMessage[] = messageList.get.all.db();
  let newest: ToolInvocationPart | undefined;
  for (const msg of messages) {
    if (!msg || msg.role !== 'assistant' || !msg.content?.parts) continue;
    for (const part of msg.content.parts) {
      if (part?.type === 'tool-invocation' && part.toolInvocation?.toolCallId === toolCallId) {
        newest = part;
      }
    }
  }
  if (!newest || !isResolvedToolInvocation(newest)) return undefined;
  return newest.toolInvocation.result;
}
