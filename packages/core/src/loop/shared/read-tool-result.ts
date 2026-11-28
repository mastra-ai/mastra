import type { MastraDBMessage, MessageList } from '../../agent/message-list';
import {
  carriesToolCallArgs,
  isTerminalToolInvocationState,
} from '../../agent/message-list/utils/tool-invocation-state';
import { deepEqual } from '../../utils/deep-equal';

type ToolInvocationPart = Extract<MastraDBMessage['content']['parts'][number], { type: 'tool-invocation' }>;

const isResolvedToolInvocation = (part: ToolInvocationPart) =>
  part.toolInvocation.state === 'result' || part.toolInvocation.state === 'output-error';

/**
 * Whether a caller's argument record identifies a stored tool call.
 *
 * The caller often holds a *sanitized* copy of the call's arguments: a durable tool
 * executes with internal-only keys (e.g. `_background`) stripped, but the stored call
 * keeps them. Exact equality would then miss the occurrence the caller means, so every
 * key the caller carries must agree with the stored call and stored-only keys are
 * tolerated. A caller that carries no arguments falls back to the id alone, matching the
 * wildcard behavior of {@link isSameToolCall}.
 */
export function toolResultArgsMatch(callerArgs: unknown, storedArgs: unknown): boolean {
  if (!carriesToolCallArgs(callerArgs) || !carriesToolCallArgs(storedArgs)) return true;
  if (deepEqual(callerArgs, storedArgs)) return true;
  if (
    typeof callerArgs !== 'object' ||
    callerArgs === null ||
    Array.isArray(callerArgs) ||
    typeof storedArgs !== 'object' ||
    storedArgs === null ||
    Array.isArray(storedArgs)
  ) {
    return false;
  }
  const caller = callerArgs as Record<string, unknown>;
  const stored = storedArgs as Record<string, unknown>;
  return Object.keys(caller).every(key => key in stored && deepEqual(caller[key], stored[key]));
}

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
 * read: pass its `args` to tell the occurrences apart. A caller that only holds a
 * sanitized copy of the arguments (internal keys stripped before a durable tool
 * runs) still matches through {@link toolResultArgsMatch}. An unresolved newest
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
      if (!toolResultArgsMatch(args, part.toolInvocation.args)) continue;
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

/**
 * Whether the message list holds a still-pending provider-executed call for `toolName`.
 *
 * Complements {@link hasPendingToolInvocation}: some providers (e.g. @ai-sdk/google
 * `file_search` running alongside a client tool) return the tool result under a
 * DIFFERENT toolCallId than the call. `updateToolInvocation`'s fallback reconciles
 * such a result by tool name, so a gate keyed only on the incoming id would wrongly
 * suppress it. Return true when any provider-executed call with this name is still
 * awaiting an outcome.
 */
export function hasPendingProviderToolInvocation(messageList: MessageList, toolName: string): boolean {
  const messages: MastraDBMessage[] = messageList.get.all.db();
  for (const msg of messages) {
    if (!msg || msg.role !== 'assistant' || !msg.content?.parts) continue;
    for (const part of msg.content.parts) {
      if (part?.type !== 'tool-invocation') continue;
      // providerExecuted exists at runtime but is not in the base part type
      const candidate = part as typeof part & { providerExecuted?: boolean };
      if (
        candidate.providerExecuted === true &&
        candidate.toolInvocation?.state === 'call' &&
        candidate.toolInvocation.toolName === toolName
      ) {
        return true;
      }
    }
  }
  return false;
}
