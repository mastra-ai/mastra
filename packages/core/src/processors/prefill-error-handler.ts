import { APICallError } from '@internal/ai-sdk-v5';

import type { Processor, ProcessAPIErrorArgs, ProcessAPIErrorResult } from './index';

const PREFILL_ERROR_PATTERNS = [
  /does not support assistant message prefill/i,
  /assistant response prefill is incompatible with enable[_\s-]?thinking/i,
  // Gemini 3+ (direct, Vertex, and gateway-routed)
  /requests ending with a model turn are not supported/i,
];

function getErrorCandidates(error: APICallError | Error): string[] {
  const candidates = [error.message];

  if (APICallError.isInstance(error) && typeof error.responseBody === 'string') {
    candidates.push(error.responseBody);
  }

  return candidates.filter(Boolean);
}

/**
 * Checks whether an error is a known assistant-response prefill rejection.
 *
 * This error occurs when the request ends with an assistant message and the model
 * interprets it as pre-filling the response, which some models don't support.
 */
function isPrefillError(error: unknown): boolean {
  const matchesKnownPrefillError = (message: string) => PREFILL_ERROR_PATTERNS.some(pattern => pattern.test(message));

  if (APICallError.isInstance(error)) {
    return getErrorCandidates(error).some(matchesKnownPrefillError);
  }

  if (error instanceof Error) {
    return getErrorCandidates(error).some(matchesKnownPrefillError);
  }

  return false;
}

/**
 * Handles known "assistant response prefill" errors reactively.
 *
 * When an LLM API call fails because the conversation ends with an assistant
 * message and the provider interprets it as pre-filling, this processor appends
 * a `continue` system reminder message and signals a retry.
 *
 * This is a reactive complement to {@link TrailingAssistantGuard}, which
 * proactively appends a user turn for providers it can identify up front
 * (Anthropic under native structured output, Gemini 3+). `PrefillErrorHandler`
 * catches the rejection whenever that identification falls short, e.g. Anthropic
 * outside structured output or a gateway whose model id hides the provider.
 *
 * @see https://github.com/mastra-ai/mastra/issues/13969
 */
export class PrefillErrorHandler implements Processor<'prefill-error-handler'> {
  readonly id = 'prefill-error-handler' as const;
  readonly name = 'Prefill Error Handler';

  async processAPIError({ error, retryCount, sendSignal }: ProcessAPIErrorArgs): Promise<ProcessAPIErrorResult | void> {
    // Only handle on first attempt — if it fails again after our fix, don't loop
    if (retryCount > 0) return;

    if (!isPrefillError(error)) return;

    await sendSignal?.({
      type: 'reactive',
      tagName: 'system-reminder',
      contents: 'continue',
      attributes: {
        type: 'anthropic-prefill-processor-retry',
      },
      metadata: {
        message: 'Continuing after prefill error',
      },
    });

    return { retry: true };
  }
}
