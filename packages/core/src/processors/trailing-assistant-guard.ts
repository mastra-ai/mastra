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
 * Guards against trailing assistant messages with Anthropic Claude 4.6.
 *
 * Claude 4.6 rejects requests where the last message is an assistant message,
 * treating it as assistant prefill. Native structured output is one trigger,
 * but the same rejection also happens in normal turns (thread resumption,
 * handoffs, and tool-call continuations).
 *
 * This processor appends a minimal user continuation message whenever the
 * prompt would otherwise end with an assistant message.
 *
 * This processor should only be added when the agent uses a Claude 4.6 model.
 * Use {@link isMaybeClaude46} to check before adding.
 *
 * @see https://github.com/mastra-ai/mastra/issues/12800
 * @see https://github.com/mastra-ai/mastra/issues/13969
 */
export class TrailingAssistantGuard implements Processor<'trailing-assistant-guard'> {
  readonly id = 'trailing-assistant-guard' as const;
  readonly name = 'Trailing Assistant Guard';

  processInputStep({ messages, structuredOutput }: ProcessInputStepArgs): ProcessInputStepResult | undefined {
    const willUseResponseFormat =
      structuredOutput?.schema && !structuredOutput?.model && !structuredOutput?.jsonPromptInjection;

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'assistant') return;

    const continuationText = willUseResponseFormat ? 'Generate the structured response.' : 'Continue.';

    return {
      messages: [
        ...messages,
        {
          id: randomUUID(),
          role: 'user' as const,
          content: {
            format: 2 as const,
            parts: [{ type: 'text' as const, text: continuationText }],
          },
          createdAt: new Date(),
        },
      ],
    };
  }
}
