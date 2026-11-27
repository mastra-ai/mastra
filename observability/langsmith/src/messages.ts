/**
 * LangSmith reads a conversation from the messages on `llm` runs. It understands the
 * OpenAI Chat Completions format, while Mastra spans hold AI SDK messages.
 * See: https://docs.langchain.com/langsmith/log-llm-trace#messages-format
 */

import type { ModelStepResult } from '@mastra/core/observability';
import type { LangSmithUsageMetrics } from './metrics';

type Part = Record<string, unknown>;

/** What one MODEL_GENERATION has recorded so far. Messages are built once and shared by every call that replays them. */
export interface Conversation {
  /** Messages the generation started with. */
  input: unknown[] | undefined;
  /** What each ended call added, in the order they ended, with the MODEL_STEP it ran in. */
  calls: Array<{ stepId: string | undefined; message: AssistantMessage }>;
  /** Tool results as the model was given them, keyed by toolCallId. */
  toolResults: Map<unknown, string>;
  /** Usage of the calls that ended so far; absent until one has. */
  counted?: LangSmithUsageMetrics;
  /** Set when the generation ends. It is then counted for whatever its calls were not. */
  ended?: boolean;
}

interface AssistantMessage {
  role: 'assistant';
  content: unknown;
  tool_calls?: ReturnType<typeof toToolCall>[];
}

function isPart(value: unknown): value is Part {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

export function toText(value: unknown): string {
  return typeof value === 'string' ? value : (JSON.stringify(value) ?? '');
}

function toToolCall({ toolCallId, toolName, input, args }: Part) {
  return { id: toolCallId, type: 'function', function: { name: toolName, arguments: toText(input ?? args) } };
}

function toAssistantMessage(content: unknown, toolCalls: Part[]): AssistantMessage {
  return {
    role: 'assistant',
    // As OpenAI sends it. With '', LangSmith shows the call again when a later turn replays it.
    content: toolCalls.length && content === '' ? null : content,
    ...(toolCalls.length ? { tool_calls: toolCalls.map(toToolCall) } : {}),
  };
}

/** A tool result as text. AI SDK v5 wraps what the model was given in a typed output: `{ type: 'json', value }`. */
export function toResultText(output: unknown): string {
  return toText(isPart(output) && 'type' in output && 'value' in output ? output.value : output);
}

/** One text string when there is nothing but text, so a replayed answer equals the answer first sent. */
function toContent(parts: unknown[]): unknown {
  const isText = (part: unknown): part is { text: string } =>
    isPart(part) && part.type === 'text' && typeof part.text === 'string';
  return parts.every(isText) ? parts.map(part => part.text).join('') : parts;
}

/** AI SDK messages as Chat Completions messages. System and user messages are returned as they are. */
export function toChatMessages(messages: unknown): unknown[] | undefined {
  if (!Array.isArray(messages)) return undefined;
  return messages.flatMap((message): unknown[] => {
    // Span serialization ends a long array with a marker string, and LangSmith drops a run with one.
    if (!isPart(message)) return [];
    if (!Array.isArray(message.content)) return [message];
    if (message.role !== 'assistant' && message.role !== 'tool') return [message];

    const ofType = (type: string) => (message.content as unknown[]).filter(part => isPart(part) && part.type === type);
    const toolCalls = ofType('tool-call') as Part[];
    const toolResults = ofType('tool-result') as Part[];
    // Chat Completions has no reasoning; LangSmith would show a replayed one as a new answer.
    const skip = [...toolCalls, ...toolResults, ...ofType('reasoning')];
    const rest = message.content.filter(part => !skip.includes(part));

    return [
      ...(message.role === 'assistant' && (rest.length || toolCalls.length)
        ? [toAssistantMessage(toContent(rest), toolCalls)]
        : []),
      ...toolResults.map(({ toolCallId, toolName, output, result, providerOptions }) => {
        // What toModelOutput gave the model, as the call that first got the result showed it.
        const mastra = isPart(providerOptions) ? providerOptions.mastra : undefined;
        const modelOutput = isPart(mastra) ? mastra.modelOutput : undefined;
        return {
          role: 'tool',
          tool_call_id: toolCallId,
          name: toolName,
          content: toResultText(modelOutput ?? output ?? result),
        };
      }),
    ];
  });
}

/** The tool calls in a model call's output. Span processors can replace them, for example with a redaction marker. */
function toolCallsIn({ toolCalls }: ModelStepResult): Part[] {
  return Array.isArray(toolCalls) ? toolCalls.filter(isPart) : [];
}

/** Whether the model call ended on tools that Mastra or the client runs, so another call has to follow. */
export function waitsForTools(result: ModelStepResult): boolean {
  return toolCallsIn(result).some(toolCall => !toolCall.providerExecuted);
}

/** The message an ended call adds to the conversation, if any. */
export function messageOfCall(result: ModelStepResult): AssistantMessage | undefined {
  const toolCalls = toolCallsIn(result);
  return result.text || toolCalls.length ? toAssistantMessage(result.text ?? '', toolCalls) : undefined;
}

/**
 * The messages of a model call: what the generation started with, then each earlier call with its
 * tool results. Tools the provider ran inside this call come last, ahead of the answer in its output.
 */
export function messagesOfCall(
  { input, calls, toolResults }: Conversation,
  result: ModelStepResult = {},
): unknown[] | undefined {
  if (!input) return undefined;
  const withResults = (message: AssistantMessage) => [
    message,
    ...(message.tool_calls ?? [])
      .filter(({ id }) => toolResults.has(id))
      .map(({ id, function: { name } }) => ({ role: 'tool', tool_call_id: id, name, content: toolResults.get(id) })),
  ];
  const providerTools = toolCallsIn(result).filter(toolCall => toolCall.providerExecuted);
  return [
    ...input,
    ...calls.flatMap(call => withResults(call.message)),
    ...(providerTools.length ? withResults(toAssistantMessage('', providerTools)) : []),
  ];
}
