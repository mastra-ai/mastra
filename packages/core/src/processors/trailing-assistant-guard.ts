import { randomUUID } from 'node:crypto';

import type { Processor, ProcessInputStepArgs, ProcessInputStepResult } from './index';

/**
 * Checks whether a model config could use the Anthropic provider.
 *
 * Handles raw model configs (strings like `'anthropic/claude-opus-4-6'`),
 * language model objects (with `provider` and `modelId`), dynamic functions
 * (returns `true` as a safe default), and model fallback arrays.
 */
export function isMaybeAnthropic(
  model:
    | string
    | { provider?: string; modelId?: string }
    | ((...args: any[]) => any)
    | { model: any; enabled?: boolean }[]
    | unknown,
): boolean {
  if (typeof model === 'function') return true;

  if (Array.isArray(model)) {
    return model.some(m => isMaybeAnthropic(m.model ?? m));
  }

  if (typeof model === 'string') {
    return model.startsWith('anthropic');
  }

  if (model && typeof model === 'object' && 'provider' in model) {
    const { provider } = model as { provider: string };
    return provider.startsWith('anthropic');
  }

  return true;
}

/**
 * Guards against trailing assistant messages when using native structured output
 * with Anthropic models.
 *
 * Anthropic rejects requests where the last message is an assistant message when
 * using output format (structured output), interpreting it as pre-filling the response.
 * This processor appends a user message to prevent that error.
 *
 * This processor should only be added when the agent uses an Anthropic model.
 * Use {@link isMaybeAnthropic} to check before adding.
 *
 * @see https://github.com/mastra-ai/mastra/issues/12800
 */
export class TrailingAssistantGuard implements Processor<'trailing-assistant-guard'> {
  readonly id = 'trailing-assistant-guard' as const;
  readonly name = 'Trailing Assistant Guard';

  processInputStep({ messages, structuredOutput }: ProcessInputStepArgs): ProcessInputStepResult | undefined {
    const willUseResponseFormat =
      structuredOutput?.schema && !structuredOutput?.model && !structuredOutput?.jsonPromptInjection;

    if (!willUseResponseFormat) return;

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'assistant') return;

    return {
      messages: [
        ...messages,
        {
          id: randomUUID(),
          role: 'user' as const,
          content: {
            format: 2 as const,
            parts: [{ type: 'text' as const, text: 'Generate the structured response.' }],
          },
          createdAt: new Date(),
        },
      ],
    };
  }
}
