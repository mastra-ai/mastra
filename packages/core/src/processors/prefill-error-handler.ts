import { randomUUID } from 'node:crypto';

import { APICallError } from '@internal/ai-sdk-v5';

import type { Processor, ProcessAPIErrorArgs, ProcessAPIErrorResult } from './index';

const PREFILL_ERROR_PATTERN = /does not support assistant message prefill/i;

/**
 * Checks whether an error is the Anthropic "assistant message prefill" rejection.
 *
 * This error occurs when the request ends with an assistant message and the model
 * interprets it as pre-filling the response, which some models don't support.
 */
function isPrefillError(error: unknown): boolean {
  if (APICallError.isInstance(error)) {
    return PREFILL_ERROR_PATTERN.test((error as Error).message);
  }

  if (error instanceof Error) {
    return PREFILL_ERROR_PATTERN.test(error.message);
  }

  return false;
}

/**
 * Handles the Anthropic "assistant message prefill" error reactively.
 *
 * When an LLM API call fails because the conversation ends with an assistant
 * message (which some Anthropic models interpret as pre-filling), this processor
 * appends a `continue` system reminder message and signals a retry.
 *
 * This is a reactive complement to {@link TrailingAssistantGuard}, which
 * proactively prevents the error only for the structured output case.
 * `PrefillErrorHandler` catches the error for all other cases (e.g., tool
 * continuations, multi-turn conversations).
 *
 * @see https://github.com/mastra-ai/mastra/issues/13969
 */
export class PrefillErrorHandler implements Processor<'prefill-error-handler'> {
  readonly id = 'prefill-error-handler' as const;
  readonly name = 'Prefill Error Handler';

  processAPIError({ error, messageList, retryCount }: ProcessAPIErrorArgs): ProcessAPIErrorResult | void {
    // Only handle on first attempt — if it fails again after our fix, don't loop
    if (retryCount > 0) return;

    if (!isPrefillError(error)) return;

    // Append a user message to break the trailing assistant pattern
    messageList.add(
      {
        id: randomUUID(),
        role: 'user' as const,
        content: {
          format: 2 as const,
          parts: [
            {
              type: 'text' as const,
              text: '<system-reminder>continue</system-reminder>',
            },
          ],
          metadata: {
            systemReminder: {
              type: 'anthropic-prefill-processor-retry',
            },
          },
        },
        createdAt: new Date(),
      },
      'input',
    );

    return { retry: true };
  }
}
