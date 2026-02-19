import { randomUUID } from 'node:crypto';

import type { Processor, ProcessInputStepArgs, ProcessInputStepResult } from './index';

const CLAUDE_46_PATTERN = /[^0-9]4[.-]6/;

/**
 * Checks whether a model config could be Claude 4.6.
 *
 * Handles raw model configs (strings like `'anthropic/claude-opus-4-6'`),
 * language model objects (with `provider` and `modelId`), dynamic functions
 * (returns `true` as a safe default), and model fallback arrays.
 */
export function isMaybeClaude46(
  model:
    | string
    | { provider?: string; modelId?: string }
    | ((...args: any[]) => any)
    | { model: any; enabled?: boolean }[]
    | unknown,
): boolean {
  if (typeof model === 'function') return true;

  if (Array.isArray(model)) {
    return model.some(m => isMaybeClaude46(m.model ?? m));
  }

  if (typeof model === 'string') {
    return model.startsWith('anthropic') && CLAUDE_46_PATTERN.test(model);
  }

  if (model && typeof model === 'object' && 'provider' in model && 'modelId' in model) {
    const { provider, modelId } = model as { provider: string; modelId: string };
    return provider.startsWith('anthropic') && CLAUDE_46_PATTERN.test(modelId);
  }

  return true;
}

/**
 * Guards against trailing assistant messages when using native structured output
 * with Anthropic Claude 4.6.
 *
 * Claude 4.6 rejects requests where the last message is an assistant message when
 * using output format (structured output), interpreting it as pre-filling the response.
 * This processor appends a user message to prevent that error.
 *
 * This processor should only be added when the agent uses a Claude 4.6 model.
 * Use {@link isMaybeClaude46} to check before adding.
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
