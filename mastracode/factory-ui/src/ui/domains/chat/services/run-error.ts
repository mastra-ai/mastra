import type { MastraErrorPart } from '@mastra/core/agent/message-list';

import { PROVIDER_AUTH_REQUIRED_ERROR } from './transcript';

interface RunErrorDescription {
  title: string;
  message: string;
  recovery?: 'credentials' | 'models' | 'continue';
}

/** Saved errors contain only name and message. Classify explicit evidence, never guess a 400's cause. */
export function describeRunError(error: MastraErrorPart['error']): RunErrorDescription {
  const message = error.message.toLowerCase();
  if (message.includes('the request has no authenticated user')) {
    return {
      title: 'Run started without an authenticated user',
      message:
        'Start the run again from a signed-in session. If this session belongs to someone else, ask its owner to restart it.',
    };
  }
  if (error.name === PROVIDER_AUTH_REQUIRED_ERROR) {
    return { title: 'Provider sign-in required', message: error.message, recovery: 'credentials' };
  }

  const providerError = error.name === 'AI_APICallError' || error.name === 'APICallError';
  if (providerError) {
    const reason = providerMessage(error.message) ?? error.message;
    // Providers also use HTTP 429 for exhausted billing quota; waiting won't resolve it.
    if (/insufficient_quota|quota (exceeded|exhausted)|exceeded your current quota|credit balance/.test(message)) {
      return {
        title: 'Provider quota exhausted',
        message: 'Check the provider account’s billing or usage allowance before continuing.',
        recovery: 'credentials',
      };
    }
    if (/invalid[_ ]api[_ ]key|unauthorized|authentication|forbidden/.test(message)) {
      return {
        title: 'Provider access failed',
        message: 'Review the credentials and model access configured for this session.',
        recovery: 'credentials',
      };
    }
    if (/context_length_exceeded|context length|maximum context|too many tokens/.test(message)) {
      return {
        title: 'Conversation exceeds the model’s limit',
        message: 'Choose a model with a larger context window or start a new session with a shorter prompt.',
        recovery: 'models',
      };
    }
    if (/model_not_found|model not found|unsupported[_ ]parameter|unsupported[_ ]value/.test(message)) {
      return {
        title: 'Model configuration rejected',
        message: 'Choose another model or use the Thinking control in the composer to adjust this session’s settings.',
        recovery: 'models',
      };
    }
    if (
      /no tool output found for (function|tool) call|tool_call_ids.*(response|respond)|tool_use.*tool_result/.test(
        message,
      )
    ) {
      return {
        title: 'Conversation history rejected',
        message:
          'The provider could not match a tool call with its result. Copy the error details so this session can be investigated.',
      };
    }
    if (/^bad request\.?$/i.test(reason.trim())) {
      return {
        title: 'Model request rejected',
        message:
          'The provider rejected the request. A specific reason isn’t available here. Copy the error details and check the server logs.',
      };
    }
    if (/invalid_request_error/.test(message)) return { title: 'Model request rejected', message: reason };
    if (/rate[_ ]limit|too many requests/.test(message)) {
      return {
        title: 'Provider rate limit reached',
        message: 'Wait a moment, then continue the run.',
        recovery: 'continue',
      };
    }
    if (
      /internal server error|server_error|service unavailable|bad gateway|gateway timeout|overloaded_error/.test(
        message,
      )
    ) {
      return {
        title: 'Model provider temporarily unavailable',
        message: 'The provider could not complete the request. You can try continuing the run.',
        recovery: 'continue',
      };
    }
    return { title: 'Model request failed', message: reason };
  }

  if (error.name.endsWith('TimeoutError') || /^(request )?timed out\.?$/i.test(error.message)) {
    return {
      title: 'Request timed out',
      message: 'The request took too long to complete. You can try continuing the run.',
      recovery: 'continue',
    };
  }
  return {
    title: 'Run stopped',
    message: error.message || 'An unexpected error stopped the run. Copy the error details to investigate.',
  };
}

/**
 * A stream that fails before any output persists the provider's event as the
 * message: `{ error }` or `{ type: 'response.failed', response: { error } }`,
 * sometimes stringified once more by the error that wrapped it.
 */
function providerMessage(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed.startsWith('{')) return trimmed || undefined;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      return providerMessage(parsed) ?? trimmed;
    } catch {
      return trimmed;
    }
  }
  if (typeof value !== 'object' || value === null) return undefined;
  if ('error' in value) return providerMessage(value.error) ?? ownMessage(value);
  if ('response' in value) return providerMessage(value.response) ?? ownMessage(value);
  return ownMessage(value);
}

function ownMessage(value: object): string | undefined {
  return 'message' in value ? providerMessage(value.message) : undefined;
}
