import type {
  LanguageModelV3CallOptions,
  LanguageModelV3FinishReason,
  LanguageModelV3Message,
  LanguageModelV3Middleware,
  LanguageModelV3StreamPart,
} from '@ai-sdk/provider';

import { PlatformMemoryClient } from './client';
import type { MemoryMessageInput, PlatformMemoryClientOptions } from './client';

export type PlatformMemoryMiddlewareOptions = PlatformMemoryClientOptions & {
  threadId: string;
  /** Who the memory belongs to. Defaults to `threadId`. */
  resourceId?: string;
  /** Load memory but never write. */
  readOnly?: boolean;
  client?: PlatformMemoryClient;
};

function textOf(content: ReadonlyArray<{ type: string; text?: string }>): string {
  return content
    .filter(part => part.type === 'text')
    .map(part => part.text ?? '')
    .join('');
}

/**
 * The user message(s) that started this turn: the last run of user messages.
 * Tool-loop steps append assistant/tool messages after it, so this is stable across steps.
 */
function turnUserMessages(prompt: LanguageModelV3Message[]): MemoryMessageInput[] {
  const last = prompt.findLastIndex(m => m.role === 'user');
  let first = last;
  while (first > 0 && prompt[first - 1]!.role === 'user') first--;
  return prompt.slice(first, last + 1).flatMap(m => {
    const content = m.role === 'user' ? textOf(m.content) : '';
    return content ? [{ role: 'user' as const, content }] : [];
  });
}

/** Intermediate tool-calling steps are not saved; the turn is saved once the model finishes. */
const isFinal = (reason: LanguageModelV3FinishReason) => reason.unified !== 'tool-calls';

/**
 * AI SDK middleware backed by a hosted Platform Memory instance.
 *
 * Before each call it prepends the instance's observations (as a system message)
 * and the unobserved message tail. After the final step it saves the user's
 * message and the model's text reply; observation runs on the Platform.
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

  async function remember(prompt: LanguageModelV3Message[] | undefined, reply: string) {
    if (readOnly || !prompt) return;
    const messages = turnUserMessages(prompt);
    if (reply) messages.push({ role: 'assistant', content: reply });
    if (messages.length) await client.saveMessages(threadId, { resourceId, messages });
  }

  return {
    specificationVersion: 'v3',

    async transformParams({ params }) {
      const context = await client.getContext(threadId, resourceId);
      const recalled: LanguageModelV3Message[] = context.messages.map(m =>
        m.role === 'assistant'
          ? { role: 'assistant', content: [{ type: 'text', text: m.content }] }
          : { role: 'user', content: [{ type: 'text', text: m.content }] },
      );
      const system = params.prompt.filter(m => m.role === 'system');
      const rest = params.prompt.filter(m => m.role !== 'system');
      const next: LanguageModelV3CallOptions = {
        ...params,
        prompt: [
          ...system,
          ...(context.system ? [{ role: 'system' as const, content: context.system }] : []),
          ...recalled,
          ...rest,
        ],
      };
      originalPrompts.set(next, params.prompt);
      return next;
    },

    async wrapGenerate({ doGenerate, params }) {
      const result = await doGenerate();
      if (isFinal(result.finishReason)) {
        await remember(originalPrompts.get(params), textOf(result.content));
      }
      return result;
    },

    async wrapStream({ doStream, params }) {
      const { stream, ...rest } = await doStream();
      const prompt = originalPrompts.get(params);
      let reply = '';
      let final = false;
      return {
        ...rest,
        stream: stream.pipeThrough(
          new TransformStream<LanguageModelV3StreamPart, LanguageModelV3StreamPart>({
            transform(part, controller) {
              if (part.type === 'text-delta') reply += part.delta;
              if (part.type === 'finish') final = isFinal(part.finishReason);
              controller.enqueue(part);
            },
            async flush() {
              if (final) await remember(prompt, reply);
            },
          }),
        ),
      };
    },
  };
}
