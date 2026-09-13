import { randomUUID } from 'node:crypto';

import { resolveJsonPromptInjectionForModel } from '../agent/structured-output';
import { requiresTrailingAssistantGuard } from './provider-history-compat';
import type { Processor, ProcessInputStepArgs, ProcessInputStepResult } from './index';

/**
 * Guards native structured output requests against a trailing assistant turn.
 *
 * Claude 4.6 and later reject assistant prefill, while Gemini 3 and later reject
 * requests ending on a model turn. This processor runs after configured input
 * processors so it evaluates the final selected model and structured output mode.
 *
 * @see https://github.com/mastra-ai/mastra/issues/12800
 * @see https://github.com/mastra-ai/mastra/issues/23320
 */
export class TrailingAssistantGuard implements Processor<'trailing-assistant-guard'> {
  readonly id = 'trailing-assistant-guard' as const;
  readonly name = 'Trailing Assistant Guard';

  processInputStep({ messages, structuredOutput, model }: ProcessInputStepArgs): ProcessInputStepResult | undefined {
    if (!requiresTrailingAssistantGuard(model)) return;

    const jsonPromptInjection = resolveJsonPromptInjectionForModel(structuredOutput?.jsonPromptInjection, model);
    const willUseResponseFormat = structuredOutput?.schema && !structuredOutput?.model && !jsonPromptInjection;
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
