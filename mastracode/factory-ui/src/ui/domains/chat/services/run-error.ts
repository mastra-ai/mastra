import { PROVIDER_AUTH_REQUIRED_ERROR } from '@mastra/code-sdk/auth/provider-auth-error';
import type { MastraErrorPart } from '@mastra/core/agent/message-list';
import { classifyProviderError, providerErrorReason } from '@mastra/core/error';

interface RunErrorDescription {
  title: string;
  message: string;
  recovery?: 'credentials';
}

const PROVIDER_ERROR_NAMES = new Set(['AI_APICallError', 'APICallError']);
const NO_REASON_AVAILABLE =
  'The provider rejected the request. A specific reason isn’t available here. Copy the error details and check the server logs.';

export function describeRunError(error: MastraErrorPart['error']): RunErrorDescription {
  if (error.name === PROVIDER_AUTH_REQUIRED_ERROR) {
    return { title: 'Provider sign-in required', message: error.message, recovery: 'credentials' };
  }
  switch (classifyProviderError(error)) {
    case 'quota':
      return {
        title: 'Provider quota exhausted',
        message: 'Check the provider account’s billing or usage allowance before continuing.',
      };
    case 'auth':
      return {
        title: 'Provider access failed',
        message: 'Review the credentials and model access configured for this session.',
      };
    case 'context_overflow':
      return {
        title: 'Conversation exceeds the model’s limit',
        message: 'Choose a model with a larger context window or start a new session with a shorter prompt.',
      };
    case 'model_rejected':
      return {
        title: 'Model configuration rejected',
        message: 'Choose another model or use the Thinking control in the composer to adjust this session’s settings.',
      };
    case 'tool_history_rejected':
      return {
        title: 'Conversation history rejected',
        message:
          'The provider could not match a tool call with its result. Copy the error details so this session can be investigated.',
      };
    case 'invalid_request':
      return { title: 'Model request rejected', message: providerErrorReason(error) ?? NO_REASON_AVAILABLE };
    case 'timeout':
      return {
        title: 'Request timed out',
        message: 'The request took too long to complete. Send a message to continue the run.',
      };
    case 'rate_limited':
      return {
        title: 'Provider rate limit reached',
        message: 'Wait a moment, then send a message to continue the run.',
      };
    case 'unavailable':
      return {
        title: 'Model provider temporarily unavailable',
        message: 'The provider could not complete the request. Send a message to continue the run.',
      };
    case 'unknown':
      return describeUnclassifiedError(error);
  }
}

function describeUnclassifiedError(error: MastraErrorPart['error']): RunErrorDescription {
  const reason = providerErrorReason(error);
  const providerShaped = PROVIDER_ERROR_NAMES.has(error.name) || (reason !== undefined && reason !== error.message);
  if (providerShaped) return { title: 'Model request failed', message: reason ?? error.message };
  return {
    title: 'Run stopped',
    message: error.message || 'An unexpected error stopped the run. Copy the error details to investigate.',
  };
}
