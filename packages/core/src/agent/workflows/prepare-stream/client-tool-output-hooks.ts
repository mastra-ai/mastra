import type { IMastraLogger } from '../../../logger';
import type { CoreTool } from '../../../tools/types';
import { normalizeModelOutput } from '../../durable/workflows/steps/normalize-model-output';
import type { MessageList, MessageListInput } from '../../message-list';

type ToolCall = { toolCallId: string; toolName: string };
type ToolResult = ToolCall & { output: unknown };

function getMessages(messages: MessageListInput): unknown[] {
  return Array.isArray(messages) ? messages : [messages];
}

function getParts(message: unknown): unknown[] {
  if (!message || typeof message !== 'object') return [];
  const record = message as Record<string, unknown>;
  if (Array.isArray(record.content)) return record.content;
  if (Array.isArray(record.parts)) return record.parts;
  return [];
}

function getToolCall(part: unknown): ToolCall | undefined {
  if (!part || typeof part !== 'object') return;
  const record = part as Record<string, unknown>;
  if (record.type === 'tool-call' && typeof record.toolCallId === 'string' && typeof record.toolName === 'string') {
    return { toolCallId: record.toolCallId, toolName: record.toolName };
  }

  if (record.type !== 'tool-invocation' || !record.toolInvocation || typeof record.toolInvocation !== 'object') return;
  const invocation = record.toolInvocation as Record<string, unknown>;
  if (
    (invocation.state === 'call' || invocation.state === 'partial-call') &&
    typeof invocation.toolCallId === 'string' &&
    typeof invocation.toolName === 'string'
  ) {
    return { toolCallId: invocation.toolCallId, toolName: invocation.toolName };
  }
}

/**
 * Unwrap the AI SDK v5 `{ type, value }` tool-output envelope.
 *
 * Only unwraps that exact 2-key wrapper shape; a client result that merely
 * happens to contain a `value` key passes through untouched. Error variants
 * come back as `{ skip: true }` — both `onOutput` and `toModelOutput` are
 * success-only.
 */
function unwrapToolOutput(value: unknown): { skip: true } | { skip: false; output: unknown } {
  const isV5Wrapper =
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    'value' in value &&
    Object.keys(value).length === 2;
  if (isV5Wrapper && (value.type === 'error-text' || value.type === 'error-json')) return { skip: true };
  return { skip: false, output: isV5Wrapper ? (value as Record<string, unknown>).value : value };
}

function getToolResult(part: unknown): ToolResult | undefined {
  if (!part || typeof part !== 'object') return;
  const record = part as Record<string, unknown>;
  if (record.type === 'tool-result' && typeof record.toolCallId === 'string' && typeof record.toolName === 'string') {
    const value = 'result' in record ? record.result : record.output;
    const unwrapped = unwrapToolOutput(value);
    if (unwrapped.skip) return;
    return { toolCallId: record.toolCallId, toolName: record.toolName, output: unwrapped.output };
  }

  if (record.type !== 'tool-invocation' || !record.toolInvocation || typeof record.toolInvocation !== 'object') return;
  const invocation = record.toolInvocation as Record<string, unknown>;
  if (
    invocation.state === 'result' &&
    typeof invocation.toolCallId === 'string' &&
    typeof invocation.toolName === 'string'
  ) {
    return { toolCallId: invocation.toolCallId, toolName: invocation.toolName, output: invocation.result };
  }
}

/** Fire `onOutput` for correlated client-executed tool results on a follow-up request. */
export async function fireClientToolOutputHooks({
  messages,
  tools,
  abortSignal,
  logger,
}: {
  messages: MessageListInput;
  tools?: Record<string, CoreTool>;
  abortSignal?: AbortSignal;
  logger?: Pick<IMastraLogger, 'error'>;
}): Promise<void> {
  if (!tools) return;
  if (!Object.values(tools).some(tool => !tool.execute && typeof tool.onOutput === 'function')) return;

  const inputMessages = getMessages(messages);
  let lastAssistantIdx = -1;
  for (let i = 0; i < inputMessages.length; i++) {
    const message = inputMessages[i];
    if (!message || typeof message !== 'object' || (message as Record<string, unknown>).role !== 'assistant') continue;

    // MessageList stores tool-role model messages as assistant DB messages. A
    // result-only DB message is not a new assistant turn and must not replace
    // the preceding assistant tool-call boundary.
    const parts = getParts(message);
    const isResultOnlyMessage = parts.length > 0 && parts.every(part => getToolResult(part));
    if (!isResultOnlyMessage) lastAssistantIdx = i;
  }
  if (lastAssistantIdx === -1) return;

  const issuedCalls = new Map<string, string>();
  for (const part of getParts(inputMessages[lastAssistantIdx])) {
    const call = getToolCall(part);
    if (call) issuedCalls.set(call.toolCallId, call.toolName);
  }
  if (issuedCalls.size === 0) return;

  for (let i = lastAssistantIdx + 1; i < inputMessages.length; i++) {
    for (const part of getParts(inputMessages[i])) {
      const result = getToolResult(part);
      if (!result || issuedCalls.get(result.toolCallId) !== result.toolName) continue;

      const tool = tools[result.toolName];
      if (!tool || tool.execute || typeof tool.onOutput !== 'function') continue;

      try {
        await tool.onOutput({ ...result, abortSignal });
      } catch (error) {
        logger?.error('Error calling client tool onOutput', {
          error,
          toolName: result.toolName,
          toolCallId: result.toolCallId,
        });
      }
    }
  }
}

/**
 * Apply a server-defined `toModelOutput` to client-supplied tool results.
 *
 * Client-side tools (no `execute`) never pass through the tool-execution step,
 * so their results never get `toModelOutput` applied there. Mirror the AI SDK
 * (`convertToModelMessages` maps every tool result, client-supplied included)
 * by computing the mapping at ingestion and caching it at
 * `providerMetadata.mastra.modelOutput` — the exact contract the execution
 * path writes — so prompt conversion restores it with no downstream changes.
 *
 * Only this request's input messages are walked: results in memory-recalled
 * history either already carry the cached mapping from the request that
 * ingested them, or predate it and stay raw — re-mapping them here would
 * re-run user code on every request without ever persisting.
 *
 * Mutates the MessageList's stored messages in place on purpose: prompt
 * building reads these same part objects, and messages saved to memory carry
 * the enrichment so reloads are cheap and idempotent.
 */
export async function applyClientToolModelOutput({
  messageList,
  tools,
  logger,
}: {
  messageList: MessageList;
  tools?: Record<string, CoreTool>;
  logger?: Pick<IMastraLogger, 'error'>;
}): Promise<void> {
  if (!tools) return;
  const isClientMappedTool = (
    tool: CoreTool,
  ): tool is CoreTool & { toModelOutput: NonNullable<CoreTool['toModelOutput']> } =>
    !tool.execute && tool.type !== 'provider-defined' && typeof tool.toModelOutput === 'function';
  if (!Object.values(tools).some(isClientMappedTool)) return;

  for (const message of messageList.get.input.db()) {
    if (message.role !== 'assistant' || message.content?.format !== 2 || !message.content.parts) continue;

    for (const part of message.content.parts) {
      if (part.type !== 'tool-invocation' || part.toolInvocation?.state !== 'result') continue;

      const mastraMetadata = part.providerMetadata?.mastra;
      // Idempotency: skip parts already mapped (retries, durable replays, and
      // messages reloaded from DB that were enriched on a previous request).
      if (
        mastraMetadata &&
        typeof mastraMetadata === 'object' &&
        ('modelOutput' in mastraMetadata || (mastraMetadata as Record<string, unknown>).modelOutputComputed)
      ) {
        continue;
      }

      const { toolName, toolCallId } = part.toolInvocation;
      const tool = tools[toolName];
      // Client-side tools only: tools WITH execute get toModelOutput applied at
      // execution time by the tool-call step, and provider-executed tools are
      // mapped by the provider round trip, not by us.
      if (!tool || !isClientMappedTool(tool)) continue;

      // Live ingestion pre-unwraps the v5 `{ type, value }` envelope, so an
      // error variant sent by the client usually arrives here as a plain value
      // and is NOT distinguishable from a success — this skip only catches
      // stored shapes that still carry the envelope.
      const unwrapped = unwrapToolOutput(part.toolInvocation.result);
      if (unwrapped.skip) continue;

      try {
        const modelOutput = normalizeModelOutput(await tool.toModelOutput(unwrapped.output));
        const nextMastra: Record<string, unknown> = {
          ...(typeof mastraMetadata === 'object' ? mastraMetadata : undefined),
          modelOutputComputed: true,
        };
        // A nullish return means "no special mapping needed" — keep the raw
        // result but still mark the part computed.
        if (modelOutput != null) nextMastra.modelOutput = modelOutput;
        part.providerMetadata = {
          ...part.providerMetadata,
          mastra: nextMastra,
        } as unknown as typeof part.providerMetadata;
      } catch (error) {
        // A failing toModelOutput must not fail the request: log and let the
        // model see the raw result (same policy as the execution path).
        logger?.error('Error calling client tool toModelOutput', { error, toolName, toolCallId });
      }
    }
  }
}
