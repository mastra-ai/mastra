import { randomUUID } from 'node:crypto';

import type { MastraDBMessage } from '../agent/message-list';
import {
  isMaybeAnthropicWithoutAssistantPrefill,
  isMaybeGoogleWithoutTrailingModelTurn,
} from './provider-history-compat';
import type { Processor, ProcessInputStepArgs, ProcessInputStepResult } from './index';

/**
 * Whether the prompt built from this message will end on a model turn.
 *
 * An assistant message whose last content part is a tool invocation is converted
 * to an assistant tool-call turn followed by a tool-result turn (prompt conversion
 * pairs still-pending calls with a placeholder result), so the prompt already ends
 * on a non-model turn. Appending a user message there would inject a spurious turn
 * into every agentic-loop step after a tool call. `step-start` parts are loop
 * markers, not content, so they are skipped when finding the last content part.
 */
function endsOnModelTurn(message: MastraDBMessage): boolean {
  if (message.role !== 'assistant') return false;

  const lastContentPart = message.content.parts.findLast(part => part.type !== 'step-start');
  return lastContentPart?.type !== 'tool-invocation';
}

/**
 * Guards against requests that would end on an assistant message for providers
 * that reject that shape.
 *
 * - Anthropic reads a trailing assistant message as response prefill. That is a
 *   legitimate feature outside structured output, so the guard only intervenes when
 *   native structured output (`responseFormat`) is in play, where Anthropic rejects it.
 * - Gemini 3 and later return 400 "Requests ending with a model turn are not
 *   supported" for any request, structured output or not, so the guard always
 *   intervenes for those models.
 *
 * In both cases a short user message is appended so the request ends on a user turn.
 * Provider and version gating for *attaching* the processor lives at the attach
 * sites; this class only decides when the appended turn is needed.
 *
 * @see https://github.com/mastra-ai/mastra/issues/12800
 * @see https://github.com/mastra-ai/mastra/issues/23320
 */
export class TrailingAssistantGuard implements Processor<'trailing-assistant-guard'> {
  readonly id = 'trailing-assistant-guard' as const;
  readonly name = 'Trailing Assistant Guard';

  processInputStep({ messages, structuredOutput, model }: ProcessInputStepArgs): ProcessInputStepResult | undefined {
    const willUseResponseFormat = Boolean(
      structuredOutput?.schema && !structuredOutput?.model && !structuredOutput?.jsonPromptInjection,
    );
    const rejectsTrailingModelTurn = isMaybeGoogleWithoutTrailingModelTurn(model);
    const rejectsStructuredOutputPrefill = rejectsTrailingModelTurn || isMaybeAnthropicWithoutAssistantPrefill(model);

    if (!rejectsTrailingModelTurn && !(willUseResponseFormat && rejectsStructuredOutputPrefill)) return;

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || !endsOnModelTurn(lastMessage)) return;

    // MessageList orders by createdAt and may have nudged the trailing assistant
    // message ahead of wall-clock time to keep it after its predecessor. Timestamp
    // strictly after it so the appended turn cannot sort before the message it guards.
    const lastCreatedAt = new Date(lastMessage.createdAt).getTime();
    const createdAt = new Date(Math.max(Date.now(), (Number.isNaN(lastCreatedAt) ? 0 : lastCreatedAt) + 1));

    return {
      messages: [
        ...messages,
        {
          id: randomUUID(),
          role: 'user' as const,
          content: {
            format: 2 as const,
            parts: [
              {
                type: 'text' as const,
                text: willUseResponseFormat ? 'Generate the structured response.' : 'Continue.',
              },
            ],
          },
          createdAt,
        },
      ],
    };
  }
}
