import type {
  JSONValue,
  LanguageModelV3CallOptions,
  LanguageModelV3Content,
  LanguageModelV3DataContent,
  LanguageModelV3FinishReason,
  LanguageModelV3Message,
  LanguageModelV3Middleware,
  LanguageModelV3StreamPart,
  LanguageModelV3ToolResultOutput,
} from '@ai-sdk/provider';

import { PlatformMemoryClient } from './client';
import type { MemoryMessage, MemoryMessagePart, PlatformMemoryClientOptions } from './client';
import {
  attachToolResult,
  filePart,
  partsOf,
  reasoningPart,
  textPart,
  toolInvocationsOf,
  toolPart,
  promptOf,
} from './parts';
import { createTurnMemory } from './turn';
import type { TurnItem } from './turn';

export type PlatformMemoryMiddlewareOptions = PlatformMemoryClientOptions & {
  threadId: string;
  /** Who the memory belongs to. Defaults to `threadId`. */
  resourceId?: string;
  /** Load memory but never write. */
  readOnly?: boolean;
  client?: PlatformMemoryClient;
};

type AssistantContent = Extract<LanguageModelV3Message, { role: 'assistant' }>['content'];
type UserContent = Extract<LanguageModelV3Message, { role: 'user' }>['content'];

function dataToString(data: LanguageModelV3DataContent): string {
  if (typeof data === 'string') return data;
  if (data instanceof URL) return data.toString();
  let binary = '';
  for (let i = 0; i < data.length; i += 0x8000) binary += String.fromCharCode(...data.subarray(i, i + 0x8000));
  return btoa(binary);
}

function parseInput(input: unknown): unknown {
  if (typeof input !== 'string') return input;
  try {
    return JSON.parse(input);
  } catch {
    return input;
  }
}

function outputValue(output: LanguageModelV3ToolResultOutput): unknown {
  return output.type === 'text' || output.type === 'json' ? output.value : output;
}

/** Converts AI SDK prompt or result content into Mastra V2 parts. */
function toParts(content: ReadonlyArray<LanguageModelV3Content | UserContent[number] | AssistantContent[number]>) {
  const parts: MemoryMessagePart[] = [];
  for (const part of content) {
    if (part.type === 'text' && part.text) parts.push(textPart(part.text));
    else if (part.type === 'reasoning' && part.text) parts.push(reasoningPart(part.text));
    else if (part.type === 'file') parts.push(filePart(dataToString(part.data), part.mediaType));
    else if (part.type === 'tool-call') {
      parts.push(toolPart({ toolCallId: part.toolCallId, toolName: part.toolName, args: parseInput(part.input) }));
    } else if (part.type === 'tool-result') {
      const result = 'output' in part ? outputValue(part.output) : part.result;
      attachToolResult(parts, part.toolCallId, result);
    }
  }
  return parts;
}

function toItems(prompt: LanguageModelV3Message[]): TurnItem[] {
  return prompt.flatMap((m): TurnItem[] => {
    if (m.role === 'user' || m.role === 'assistant') return [{ role: m.role, parts: toParts(m.content) }];
    if (m.role === 'tool') {
      const results = m.content.flatMap(p =>
        p.type === 'tool-result' ? [{ toolCallId: p.toolCallId, result: outputValue(p.output) }] : [],
      );
      return [{ role: 'tool', results }];
    }
    return [];
  });
}

/** Replays a recalled message, including tool calls and their results, as AI SDK prompt messages. */
function fromMemory(message: MemoryMessage): LanguageModelV3Message[] {
  if (message.role === 'system') return [{ role: 'system', content: message.content }];
  const parts = partsOf(message);
  if (message.role !== 'assistant') {
    const content: UserContent = parts.flatMap((part): UserContent => {
      if (part.type === 'text') return [{ type: 'text', text: part.text as string }];
      if (part.type === 'file')
        return [{ type: 'file', data: part.data as string, mediaType: part.mimeType as string }];
      return [];
    });
    return content.length ? [{ role: 'user', content }] : [];
  }

  const content: AssistantContent = parts.flatMap((part): AssistantContent => {
    if (part.type === 'text') return [{ type: 'text', text: part.text as string }];
    if (part.type === 'reasoning') return [{ type: 'reasoning', text: part.reasoning as string }];
    if (part.type === 'file') return [{ type: 'file', data: part.data as string, mediaType: part.mimeType as string }];
    return [];
  });
  const results = toolInvocationsOf(parts).filter(t => t.state === 'result');
  // A tool call is only valid in a prompt alongside its result.
  content.push(
    ...results.map(t => ({
      type: 'tool-call' as const,
      toolCallId: t.toolCallId,
      toolName: t.toolName,
      input: t.args,
    })),
  );
  const replay: LanguageModelV3Message[] = content.length ? [{ role: 'assistant', content }] : [];
  if (results.length) {
    replay.push({
      role: 'tool',
      content: results.map(t => ({
        type: 'tool-result',
        toolCallId: t.toolCallId,
        toolName: t.toolName,
        output: { type: 'json', value: (t.result ?? null) as JSONValue },
      })),
    });
  }
  return replay;
}

const isFinal = (reason: LanguageModelV3FinishReason) => reason.unified !== 'tool-calls';

/**
 * AI SDK middleware backed by a hosted Platform Memory instance.
 *
 * Before each call it prepends the instance's observations (as a system message)
 * and the unobserved message tail. After the final step it saves the user's
 * message and the model's reply, including tool calls, reasoning, and files;
 * observation runs on the Platform.
 *
 * Send only the new user message: earlier turns come from memory.
 *
 * ```ts
 * const model = wrapLanguageModel({
 *   model: openai('gpt-5'),
 *   middleware: platformMemoryMiddleware({ threadId, resourceId: userId }),
 * });
 * ```
 */
export function platformMemoryMiddleware(options: PlatformMemoryMiddlewareOptions): LanguageModelV3Middleware {
  const client = options.client ?? new PlatformMemoryClient(options);
  const { threadId, readOnly } = options;
  const resourceId = options.resourceId ?? threadId;
  const originalPrompts = new WeakMap<LanguageModelV3CallOptions, LanguageModelV3Message[]>();
  const turns = createTurnMemory(client, readOnly);
  const remember = async (prompt: LanguageModelV3Message[] | undefined, reply: MemoryMessagePart[]) => {
    if (prompt) await turns.save(threadId, resourceId, toItems(prompt), reply);
  };

  return {
    specificationVersion: 'v3',

    async transformParams({ params }) {
      const saved = await turns.beforeStep(threadId, resourceId, toItems(params.prompt));
      const context = await client.getContext(threadId, resourceId);
      const system = params.prompt.filter(m => m.role === 'system');
      // Mid tool loop the turn so far is already saved, so memory returns it (observed or as the tail).
      const rest = saved ? [] : params.prompt.filter(m => m.role !== 'system');
      const next: LanguageModelV3CallOptions = {
        ...params,
        prompt: [...system, ...promptOf(context).flatMap(fromMemory), ...rest],
      };
      originalPrompts.set(next, params.prompt);
      return next;
    },

    async wrapGenerate({ doGenerate, params }) {
      const result = await doGenerate();
      if (isFinal(result.finishReason)) {
        await remember(originalPrompts.get(params), toParts(result.content));
      }
      return result;
    },

    async wrapStream({ doStream, params }) {
      const { stream, ...rest } = await doStream();
      const prompt = originalPrompts.get(params);
      const content: LanguageModelV3Content[] = [];
      let text = '';
      let reasoning = '';
      const flushDeltas = () => {
        if (reasoning) content.push({ type: 'reasoning', text: reasoning });
        if (text) content.push({ type: 'text', text });
        reasoning = text = '';
      };
      let final = false;
      return {
        ...rest,
        stream: stream.pipeThrough(
          new TransformStream<LanguageModelV3StreamPart, LanguageModelV3StreamPart>({
            transform(part, controller) {
              if (part.type === 'text-delta') text += part.delta;
              else if (part.type === 'reasoning-delta') reasoning += part.delta;
              else if (part.type === 'file' || part.type === 'tool-call' || part.type === 'tool-result') {
                flushDeltas();
                content.push(part);
              } else if (part.type === 'finish') final = isFinal(part.finishReason);
              controller.enqueue(part);
            },
            async flush() {
              flushDeltas();
              if (final) await remember(prompt, toParts(content));
            },
          }),
        ),
      };
    },
  };
}
