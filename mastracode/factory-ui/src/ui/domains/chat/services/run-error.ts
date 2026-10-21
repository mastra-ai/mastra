import type { MastraErrorPart } from '@mastra/core/agent/message-list';

import { PROVIDER_AUTH_REQUIRED_ERROR } from './transcript';

interface RunErrorDescription {
  title: string;
  message: string;
  recovery?: 'credentials' | 'models' | 'continue';
}

const PROVIDER_ERROR_NAMES = new Set(['AI_APICallError', 'APICallError']);

// Providers also use HTTP 429 for exhausted billing quota; waiting won't resolve it.
// Same wordings as the SDK's account-rotation quota detector, minus plain rate limits.
const QUOTA_EXHAUSTED =
  /usage (?:limit|cap)|insufficient[_ ]quota|quota (?:exceeded|exhausted|reached)|exceeded (?:your )?current quota|insufficient (?:balance|credits?)|credits? exhausted|credit balance|weekly limit|monthly limit/;
const ACCESS_DENIED =
  /invalid[_ ]api[_ ]key|incorrect api key|api key not valid|unauthorized|authentication|forbidden|permission[_ ]?(denied|error)|access[_ ]?denied/;
// Same wordings as packages/memory's context-overflow detector (OpenAI, Anthropic, Google, Bedrock, xAI, local).
const CONTEXT_OVERFLOW = [
  /context[_ ]length[_ ]exceeded/,
  /maximum context length/,
  /maximum prompt length/,
  /prompt is too long/,
  /input is too long/,
  /exceed\w*\b[^.]{0,40}\bcontext (?:window|length|limit|size)/,
  /input token count[^.]{0,40}exceeds the maximum/,
  /reduce the length of the (?:messages|prompt|input)/,
];
const MODEL_REJECTED =
  /model_not_found|model not found|not_found_error|invalid[_ ]model|unsupported[_ ]parameter|unsupported[_ ]value/;
const HISTORY_REJECTED =
  /no tool output found for (function|tool) call|tool_call_ids.*(response|respond)|tool_use.*tool_result/;
const TIMED_OUT = /timed out|timeout|deadline exceeded/;
const RATE_LIMITED = /rate[_ ]limit|too many requests|resource_exhausted|throttl/;
// Same set as the retryable codes in core's stream-error-retry-processor.
const PROVIDER_UNAVAILABLE =
  /internal server error|server_error|internal_error|service[_ ]?unavailable|temporarily[_ ]?unavailable|bad gateway|overloaded/;

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
  if (QUOTA_EXHAUSTED.test(message)) {
    return {
      title: 'Provider quota exhausted',
      message: 'Check the provider account’s billing or usage allowance before continuing.',
      recovery: 'credentials',
    };
  }
  if (ACCESS_DENIED.test(message)) {
    return {
      title: 'Provider access failed',
      message: 'Review the credentials and model access configured for this session.',
      recovery: 'credentials',
    };
  }
  if (CONTEXT_OVERFLOW.some(pattern => pattern.test(message))) {
    return {
      title: 'Conversation exceeds the model’s limit',
      message: 'Choose a model with a larger context window or start a new session with a shorter prompt.',
      recovery: 'models',
    };
  }
  if (MODEL_REJECTED.test(message)) {
    return {
      title: 'Model configuration rejected',
      message: 'Choose another model or use the Thinking control in the composer to adjust this session’s settings.',
      recovery: 'models',
    };
  }
  if (HISTORY_REJECTED.test(message)) {
    return {
      title: 'Conversation history rejected',
      message:
        'The provider could not match a tool call with its result. Copy the error details so this session can be investigated.',
    };
  }

  const reason = providerMessage(error.message) ?? error.message;
  if (/^bad request\.?$/i.test(reason.trim())) {
    return {
      title: 'Model request rejected',
      message:
        'The provider rejected the request. A specific reason isn’t available here. Copy the error details and check the server logs.',
    };
  }
  if (message.includes('invalid_request_error')) return { title: 'Model request rejected', message: reason };
  if (error.name.endsWith('TimeoutError') || TIMED_OUT.test(message)) {
    return {
      title: 'Request timed out',
      message: 'The request took too long to complete. You can try continuing the run.',
      recovery: 'continue',
    };
  }
  if (RATE_LIMITED.test(message)) {
    return {
      title: 'Provider rate limit reached',
      message: 'Wait a moment, then continue the run.',
      recovery: 'continue',
    };
  }
  if (PROVIDER_UNAVAILABLE.test(message)) {
    return {
      title: 'Model provider temporarily unavailable',
      message: 'The provider could not complete the request. You can try continuing the run.',
      recovery: 'continue',
    };
  }

  const providerShaped = PROVIDER_ERROR_NAMES.has(error.name) || reason !== error.message;
  if (providerShaped) return { title: 'Model request failed', message: reason };
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
