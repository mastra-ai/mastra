import { randomUUID } from 'node:crypto';

import type { Processor, ProcessInputStepArgs, ProcessInputStepResult } from './index';

/**
 * Guards against trailing assistant messages when using native structured output
 * with Anthropic Claude 4.6.
 *
 * Claude 4.6 rejects requests where the last message is an assistant message when
 * using output format (structured output), interpreting it as pre-filling the response.
 * This processor appends a user message to prevent that error.
 *
 * @see https://github.com/mastra-ai/mastra/issues/12800
 */
export class TrailingAssistantGuard implements Processor<'trailing-assistant-guard'> {
  readonly id = 'trailing-assistant-guard' as const;

  processInputStep({ messages, model, structuredOutput }: ProcessInputStepArgs): ProcessInputStepResult | undefined {
    const isClaude46 = model.provider.startsWith('anthropic') && /[^0-9]4[.-]6/.test(model.modelId);
    const willUseResponseFormat =
      structuredOutput?.schema && !structuredOutput?.model && !structuredOutput?.jsonPromptInjection;

    if (!isClaude46 || !willUseResponseFormat) return;

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
