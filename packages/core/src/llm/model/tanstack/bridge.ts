/**
 * Protocol bridge that wraps a TanStack AI TextAdapter as a MastraLanguageModelV2.
 *
 * This lets users pass `openaiText('gpt-4o')` (or any TanStack AI adapter)
 * directly to a Mastra Agent. The bridge:
 *  1. Translates AI SDK V2 prompts/tools → TanStack's `TextOptions` format
 *  2. Calls the adapter's `chatStream()` — the *actual* TanStack implementation
 *  3. Translates AG-UI `StreamChunk` events back → AI SDK V2 `LanguageModelV2StreamPart`
 *
 * No hard dependency on @tanstack/ai — all types are structural.
 */
import type { LanguageModelV2, LanguageModelV2CallOptions, LanguageModelV2StreamPart } from '@ai-sdk/provider-v5';
import type { MastraLanguageModelV2 } from '../shared.types';

// ---------------------------------------------------------------------------
// Structural types for TanStack AI (duck-typed, no import dependency)
// ---------------------------------------------------------------------------

/** AG-UI event type string literals emitted by TanStack adapters. */
type AGUIEventType =
  | 'TEXT_MESSAGE_START'
  | 'TEXT_MESSAGE_CONTENT'
  | 'TEXT_MESSAGE_END'
  | 'TOOL_CALL_START'
  | 'TOOL_CALL_ARGS'
  | 'TOOL_CALL_END'
  | 'RUN_STARTED'
  | 'RUN_FINISHED'
  | 'RUN_ERROR'
  | 'REASONING_START'
  | 'REASONING_MESSAGE_START'
  | 'REASONING_MESSAGE_CONTENT'
  | 'REASONING_MESSAGE_END'
  | 'REASONING_END'
  | 'STEP_STARTED'
  | 'STEP_FINISHED'
  | 'CUSTOM'
  | string;

/** Minimal AG-UI event shape we consume. */
interface AGUIEvent {
  type: AGUIEventType;
  [key: string]: unknown;
}

/** Minimal TanStack AI ModelMessage shape. */
interface TanStackModelMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string | null | Array<{ type: string; [key: string]: unknown }>;
  name?: string;
  toolCalls?: Array<{ id: string; name: string; arguments: string; [key: string]: unknown }>;
  toolCallId?: string;
  thinking?: Array<{ content: string; signature?: string }>;
}

/** Minimal TanStack AI tool definition shape. */
interface TanStackToolDef {
  name: string;
  description?: string;
  inputSchema: unknown;
  [key: string]: unknown;
}

/** TanStack TextOptions shape (what chatStream expects). */
interface TanStackTextOptions {
  model: string;
  messages: Array<TanStackModelMessage>;
  tools?: Array<TanStackToolDef>;
  systemPrompts?: Array<string>;
  abortController?: AbortController;
  logger: { request: () => void; provider: () => void; errors: (e: unknown) => void };
  [key: string]: unknown;
}

/** Structural shape of a TanStack AI TextAdapter. */
export interface TanStackTextAdapterLike {
  readonly kind: 'text';
  readonly name: string;
  readonly model: string;
  chatStream: (options: TanStackTextOptions) => AsyncIterable<AGUIEvent>;
  structuredOutput?: (options: unknown) => Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

export function isTanStackTextAdapter(value: unknown): value is TanStackTextAdapterLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<string, unknown>).kind === 'text' &&
    typeof (value as Record<string, unknown>).name === 'string' &&
    typeof (value as Record<string, unknown>).model === 'string' &&
    typeof (value as Record<string, unknown>).chatStream === 'function' &&
    !('specificationVersion' in value)
  );
}

// ---------------------------------------------------------------------------
// Prompt translation: AI SDK V2 → TanStack ModelMessage[]
// ---------------------------------------------------------------------------

function translatePrompt(
  prompt: LanguageModelV2CallOptions['prompt'],
): { systemPrompts: Array<string>; messages: Array<TanStackModelMessage> } {
  const systemPrompts: Array<string> = [];
  const messages: Array<TanStackModelMessage> = [];

  for (const msg of prompt) {
    if (msg.role === 'system') {
      systemPrompts.push(msg.content);
      continue;
    }

    if (msg.role === 'user') {
      const textParts = msg.content
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map(p => p.text);
      messages.push({
        role: 'user',
        content: textParts.length === 1 ? textParts[0]! : textParts.join('\n'),
      });
      continue;
    }

    if (msg.role === 'assistant') {
      const textParts: string[] = [];
      const toolCalls: Array<{ id: string; name: string; arguments: string; state: string }> = [];
      const thinking: Array<{ content: string }> = [];

      for (const part of msg.content) {
        if (part.type === 'text') {
          textParts.push(part.text);
        } else if (part.type === 'tool-call') {
          toolCalls.push({
            id: part.toolCallId,
            name: part.toolName,
            arguments: typeof part.input === 'string' ? part.input : JSON.stringify(part.input),
            state: 'complete',
          });
        } else if (part.type === 'reasoning') {
          thinking.push({ content: part.text });
        }
      }

      const assistantMsg: TanStackModelMessage = {
        role: 'assistant',
        content: textParts.join('') || null,
      };
      if (toolCalls.length > 0) assistantMsg.toolCalls = toolCalls;
      if (thinking.length > 0) assistantMsg.thinking = thinking;
      messages.push(assistantMsg);
      continue;
    }

    if (msg.role === 'tool') {
      for (const part of msg.content) {
        if (part.type === 'tool-result') {
          let contentStr: string;
          if (part.output.type === 'text' || part.output.type === 'error-text') {
            contentStr = part.output.value;
          } else if (part.output.type === 'json' || part.output.type === 'error-json') {
            contentStr = JSON.stringify(part.output.value);
          } else {
            // 'content' type — serialize text parts
            contentStr = (part.output as { value: Array<{ type: string; text?: string }> }).value
              .filter(v => v.type === 'text' && v.text)
              .map(v => v.text)
              .join('\n');
          }
          messages.push({
            role: 'tool',
            content: contentStr,
            toolCallId: part.toolCallId,
          });
        }
      }
    }
  }

  return { systemPrompts, messages };
}

// ---------------------------------------------------------------------------
// Tool translation: AI SDK V2 FunctionTool → TanStack tool def
// ---------------------------------------------------------------------------

function translateTools(
  tools: LanguageModelV2CallOptions['tools'],
): Array<TanStackToolDef> | undefined {
  if (!tools?.length) return undefined;

  return tools
    .filter((t): t is { type: 'function'; name: string; description?: string; inputSchema: unknown } => t.type === 'function')
    .map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));
}

// ---------------------------------------------------------------------------
// Stream translation: AG-UI events → AI SDK V2 stream parts
// ---------------------------------------------------------------------------

function createAGUIToAISDKStream(
  asyncIterable: AsyncIterable<AGUIEvent>,
): ReadableStream<LanguageModelV2StreamPart> {
  // Track state for accumulating tool call args
  const toolCallArgs = new Map<string, { name: string; args: string }>();
  let textMessageId = '';
  let reasoningId = '';

  return new ReadableStream<LanguageModelV2StreamPart>({
    async start(controller) {
      try {
        controller.enqueue({ type: 'stream-start', warnings: [] });

        for await (const event of asyncIterable) {
          switch (event.type) {
            case 'RUN_STARTED': {
              const modelId = (event as { model?: string }).model;
              if (modelId) {
                controller.enqueue({ type: 'response-metadata', modelId });
              }
              break;
            }

            case 'TEXT_MESSAGE_START': {
              textMessageId = (event as { messageId?: string }).messageId || `text-${Date.now()}`;
              controller.enqueue({ type: 'text-start', id: textMessageId });
              break;
            }

            case 'TEXT_MESSAGE_CONTENT': {
              const delta = (event as { delta?: string }).delta || '';
              if (delta) {
                controller.enqueue({
                  type: 'text-delta',
                  id: textMessageId,
                  delta,
                });
              }
              break;
            }

            case 'TEXT_MESSAGE_END': {
              controller.enqueue({ type: 'text-end', id: textMessageId });
              break;
            }

            case 'TOOL_CALL_START': {
              const toolCallId = (event as { toolCallId?: string }).toolCallId || `tc-${Date.now()}`;
              const toolCallName = (event as { toolCallName?: string }).toolCallName ||
                (event as { toolName?: string }).toolName || '';
              toolCallArgs.set(toolCallId, { name: toolCallName, args: '' });
              controller.enqueue({
                type: 'tool-input-start',
                id: toolCallId,
                toolName: toolCallName,
              });
              break;
            }

            case 'TOOL_CALL_ARGS': {
              const toolCallId = (event as { toolCallId?: string }).toolCallId || '';
              const delta = (event as { delta?: string }).delta || '';
              const entry = toolCallArgs.get(toolCallId);
              if (entry) {
                entry.args += delta;
              }
              if (delta) {
                controller.enqueue({
                  type: 'tool-input-delta',
                  id: toolCallId,
                  delta,
                });
              }
              break;
            }

            case 'TOOL_CALL_END': {
              const toolCallId = (event as { toolCallId?: string }).toolCallId || '';
              const entry = toolCallArgs.get(toolCallId);
              controller.enqueue({
                type: 'tool-input-end',
                id: toolCallId,
              });
              // Emit the complete tool-call
              controller.enqueue({
                type: 'tool-call',
                toolCallId,
                toolName: entry?.name || '',
                input: entry?.args || '{}',
              });
              toolCallArgs.delete(toolCallId);
              break;
            }

            case 'REASONING_START':
            case 'REASONING_MESSAGE_START': {
              reasoningId = `reasoning-${Date.now()}`;
              controller.enqueue({ type: 'reasoning-start', id: reasoningId });
              break;
            }

            case 'REASONING_MESSAGE_CONTENT': {
              const delta = (event as { delta?: string }).delta || '';
              if (delta) {
                controller.enqueue({
                  type: 'reasoning-delta',
                  id: reasoningId,
                  delta,
                });
              }
              break;
            }

            case 'REASONING_END':
            case 'REASONING_MESSAGE_END': {
              controller.enqueue({ type: 'reasoning-end', id: reasoningId });
              break;
            }

            case 'RUN_FINISHED': {
              const finishedEvent = event as {
                finishReason?: string;
                usage?: {
                  inputTokens?: number;
                  outputTokens?: number;
                  totalTokens?: number;
                  promptTokens?: number;
                  completionTokens?: number;
                };
              };

              const usage = finishedEvent.usage;
              controller.enqueue({
                type: 'finish',
                finishReason: mapFinishReason(finishedEvent.finishReason),
                usage: {
                  inputTokens: usage?.inputTokens ?? usage?.promptTokens ?? undefined,
                  outputTokens: usage?.outputTokens ?? usage?.completionTokens ?? undefined,
                  totalTokens: usage?.totalTokens ?? undefined,
                },
              });
              break;
            }

            case 'RUN_ERROR': {
              const errorMessage = (event as { message?: string }).message || 'Unknown TanStack adapter error';
              controller.enqueue({
                type: 'error',
                error: new Error(errorMessage),
              });
              break;
            }

            // Events we intentionally skip (state, messages snapshot, custom, step, etc.)
            default:
              break;
          }
        }
      } catch (err) {
        controller.enqueue({
          type: 'error',
          error: err instanceof Error ? err : new Error(String(err)),
        });
      } finally {
        controller.close();
      }
    },
  });
}

function mapFinishReason(reason: string | undefined | null): 'stop' | 'length' | 'content-filter' | 'tool-calls' | 'error' | 'other' | 'unknown' {
  switch (reason) {
    case 'stop': return 'stop';
    case 'length': return 'length';
    case 'content_filter': return 'content-filter';
    case 'tool_calls': return 'tool-calls';
    case 'error': return 'error';
    default: return 'unknown';
  }
}

// ---------------------------------------------------------------------------
// Bridge class
// ---------------------------------------------------------------------------

type DoStreamResult = Awaited<ReturnType<LanguageModelV2['doStream']>>;

/**
 * Wraps a TanStack AI TextAdapter as a MastraLanguageModelV2.
 *
 * The adapter's `chatStream()` is called with translated prompts/tools,
 * and its AG-UI stream events are translated to AI SDK V2 stream parts.
 */
export class TanStackLanguageModel implements MastraLanguageModelV2 {
  readonly specificationVersion: 'v2' = 'v2';
  readonly provider: string;
  readonly modelId: string;
  supportedUrls: Record<string, RegExp[]> = {};

  #adapter: TanStackTextAdapterLike;

  constructor(adapter: TanStackTextAdapterLike) {
    this.#adapter = adapter;
    this.provider = adapter.name;
    this.modelId = adapter.model;
  }

  async doGenerate(options: LanguageModelV2CallOptions): Promise<DoStreamResult> {
    return this.doStream(options);
  }

  async doStream(options: LanguageModelV2CallOptions): Promise<DoStreamResult> {
    const { systemPrompts, messages } = translatePrompt(options.prompt);
    const tools = translateTools(options.tools);

    const abortController = options.abortSignal
      ? (() => {
          const ac = new AbortController();
          options.abortSignal!.addEventListener('abort', () => ac.abort(), { once: true });
          return ac;
        })()
      : undefined;

    const textOptions: TanStackTextOptions = {
      model: this.#adapter.model,
      messages,
      tools,
      systemPrompts: systemPrompts.length > 0 ? systemPrompts : undefined,
      abortController,
      logger: { request: () => {}, provider: () => {}, errors: () => {} },
    };

    const agStream = this.#adapter.chatStream(textOptions);
    const stream = createAGUIToAISDKStream(agStream);

    return { stream };
  }

  serializeForSpan(): { specificationVersion: 'v2'; modelId: string; provider: string } {
    return {
      specificationVersion: this.specificationVersion,
      modelId: this.modelId,
      provider: this.provider,
    };
  }
}
