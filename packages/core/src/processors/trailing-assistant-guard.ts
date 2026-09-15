import { randomUUID } from 'node:crypto';

import type { Processor, ProcessInputStepArgs, ProcessInputStepResult } from './index';

/**
 * Guards against trailing assistant messages when using native structured output.
 *
 * Some providers reject a request whose last message is an assistant turn:
 * Anthropic interprets it as pre-filling the response (Claude 4.6 and later reject
 * prefill outright), and Gemini 3 and later return 400 "Requests ending with a model
 * turn are not supported". This processor appends a user message to prevent that error.
 *
 * The processor itself is provider-agnostic; the provider and version gating lives at
 * the attach sites, which decide whether to add it.
 *
 * @see https://github.com/mastra-ai/mastra/issues/12800
 * @see https://github.com/mastra-ai/mastra/issues/23320
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
