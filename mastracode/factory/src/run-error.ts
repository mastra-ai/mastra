import { PROVIDER_AUTH_REQUIRED_ERROR } from '@mastra/code-sdk/auth/provider-auth-error';
import {
  classifyProviderError,
  PROVIDER_CALL_ERROR_NAME,
  providerErrorReason,
  providerModelId,
} from '@mastra/core/error';

export type RunErrorRecovery = 'continue' | 'credentials' | 'model' | 'new_session';

export interface RunErrorDescription {
  title: string;
  message: string;
  recoveries: RunErrorRecovery[];
  model?: string;
}

export interface RunErrorIdentity {
  name: string;
  message: string;
}

const UNEXPECTED_ERROR = 'An unexpected error stopped the run. Copy the error details to investigate.';
const NO_REASON_AVAILABLE =
  'The provider rejected the request. A specific reason isn’t available here. Copy the error details and check the server logs.';

export function describeRunError(error: RunErrorIdentity): RunErrorDescription {
  return { ...explainRunError(error), model: providerModelId(error) };
}

function explainRunError(error: RunErrorIdentity): Omit<RunErrorDescription, 'model'> {
  if (error.name === PROVIDER_AUTH_REQUIRED_ERROR) {
    return { title: 'Provider sign-in required', message: error.message, recoveries: ['credentials', 'model'] };
  }
  switch (classifyProviderError(error)) {
    case 'quota':
      return {
        title: 'Provider quota exhausted',
        message: afterProviderReason(
          error,
          'Check the provider account’s billing or usage allowance, or use another credential or model.',
        ),
        recoveries: ['credentials', 'model'],
      };
    case 'auth':
      return {
        title: 'Provider access failed',
        message: afterProviderReason(error, 'Review the credentials and model access configured for this session.'),
        recoveries: ['credentials', 'model'],
      };
    case 'context_overflow':
      return {
        title: 'Conversation exceeds the model’s limit',
        message: 'Choose a model with a larger context window or start a new session with a shorter prompt.',
        recoveries: ['model', 'new_session'],
      };
    case 'model_rejected':
      return {
        title: 'Model not available',
        message: afterProviderReason(
          error,
          'Choose another model for this session.',
          'The provider rejected this model.',
        ),
        recoveries: ['model'],
      };
    case 'tool_history_rejected':
      return {
        title: 'Conversation history rejected',
        message:
          'The provider could not match a tool call with its result. Start a new session to keep working, and copy the error details so this session can be investigated.',
        recoveries: ['new_session'],
      };
    case 'invalid_request':
      return {
        title: 'Model request rejected',
        message: providerErrorReason(error) ?? NO_REASON_AVAILABLE,
        recoveries: ['model'],
      };
    case 'timeout':
      return {
        title: 'Request timed out',
        message: 'The request took too long to complete. Send a message to continue the run.',
        recoveries: ['continue'],
      };
    case 'rate_limited':
      return {
        title: 'Provider rate limit reached',
        message: 'Wait a moment, then send a message to continue the run, or use another credential or model.',
        recoveries: ['continue', 'credentials', 'model'],
      };
    case 'unavailable':
      return {
        title: 'Model provider temporarily unavailable',
        message:
          'The provider could not complete the request. Send a message to continue the run, or choose another model.',
        recoveries: ['continue', 'model'],
      };
    case 'unknown':
      return describeUnclassifiedError(error);
  }
}

function afterProviderReason(error: RunErrorIdentity, next: string, fallback?: string): string {
  const reason = providerErrorReason(error) ?? fallback;
  return reason ? `${reason.replace(/\.?$/, '.')} ${next}` : next;
}

function describeUnclassifiedError(error: RunErrorIdentity): Omit<RunErrorDescription, 'model'> {
  const message = providerErrorReason(error) ?? (error.message || UNEXPECTED_ERROR);
  const providerCall = PROVIDER_CALL_ERROR_NAME.test(error.name);
  return {
    title: providerCall ? 'Model request failed' : 'Run stopped',
    message,
    recoveries: providerCall ? ['model'] : [],
  };
}
