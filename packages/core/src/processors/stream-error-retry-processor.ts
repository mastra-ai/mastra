import { DEFAULT_STREAM_ERROR_RETRY_MATCHERS, isRetryableApiError } from './retryable-error';
import type { StreamErrorRetryMatcher } from './retryable-error';
import type { Processor, ProcessAPIErrorArgs, ProcessAPIErrorResult } from './index';

export { isRetryableOpenAIResponsesStreamError, type StreamErrorRetryMatcher } from './retryable-error';

export type StreamErrorRetryProcessorOptions = {
  maxRetries?: number;
  matchers?: StreamErrorRetryMatcher[];
};

const DEFAULT_MAX_RETRIES = 1;
const DEFAULT_MATCHERS = DEFAULT_STREAM_ERROR_RETRY_MATCHERS;

export class StreamErrorRetryProcessor implements Processor<'stream-error-retry-processor'> {
  readonly id = 'stream-error-retry-processor' as const;
  readonly name = 'Stream Error Retry Processor';

  readonly #maxRetries: number;
  readonly #matchers: StreamErrorRetryMatcher[];

  constructor(options: StreamErrorRetryProcessorOptions = {}) {
    this.#maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.#matchers = [...DEFAULT_MATCHERS, ...(options.matchers ?? [])];
  }

  async processAPIError({ error, retryCount }: ProcessAPIErrorArgs): Promise<ProcessAPIErrorResult | void> {
    if (retryCount >= this.#maxRetries) return;
    if (!isRetryableApiError(error, this.#matchers)) return;

    return { retry: true };
  }
}
