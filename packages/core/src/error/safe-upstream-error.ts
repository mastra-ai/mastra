import type { APICallError } from '@internal/ai-sdk-v5';

/**
 * Reduce provider errors to metadata that is safe to hand to application
 * loggers. APICallError instances retain request bodies, response bodies, and
 * response headers; logging the instance directly can therefore disclose
 * authorization state, cookies, prompts, or provider payloads.
 */
export function safeUpstreamErrorForLog(error: APICallError): {
  name: string;
  message: string;
  statusCode?: number;
  isRetryable: boolean;
} {
  return {
    name: error.name,
    message: 'Upstream provider request failed.',
    ...(typeof error.statusCode === 'number' ? { statusCode: error.statusCode } : {}),
    isRetryable: error.isRetryable,
  };
}
