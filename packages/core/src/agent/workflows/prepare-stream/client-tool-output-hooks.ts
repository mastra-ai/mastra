import type { IMastraLogger } from '../../../logger';
import type { CoreTool } from '../../../tools/types';
import type { MessageListInput } from '../../message-list';

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

function getToolResult(part: unknown): ToolResult | undefined {
  if (!part || typeof part !== 'object') return;
  const record = part as Record<string, unknown>;
  if (record.type === 'tool-result' && typeof record.toolCallId === 'string' && typeof record.toolName === 'string') {
    const value = 'result' in record ? record.result : record.output;
    // AI SDK v5 wraps tool output as `{ type: 'json' | 'text' | ..., value }`.
    // Only unwrap that exact wrapper shape; a client result that merely happens
    // to contain a `value` key must pass through untouched.
    const isV5Wrapper =
      typeof value === 'object' &&
      value !== null &&
      'type' in value &&
      'value' in value &&
      Object.keys(value).length === 2;
    // `onOutput` is a success-only hook: skip v5 error result variants.
    if (isV5Wrapper && (value.type === 'error-text' || value.type === 'error-json')) return;
    const output = isV5Wrapper ? (value as Record<string, unknown>).value : value;
    return { toolCallId: record.toolCallId, toolName: record.toolName, output };
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
