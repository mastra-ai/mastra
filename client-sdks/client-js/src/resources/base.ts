import type { RequestOptions, ClientOptions } from '../types';
import { MastraClientError } from '../types';
import {
  isTerminalHttpError,
  isTraceQueryTimeoutError,
  mergeAbortSignals,
  mergeHeaders,
  normalizeRoutePath,
} from '../utils';

/**
 * Retry attempts applied when the caller has not configured one. Only read
 * methods keep this default; every other method is attempted once unless the
 * caller opts in with an explicit `retries` count.
 */
const DEFAULT_RETRIES = 3;

/**
 * HTTP methods that read server state. A retried read only repeats a lookup,
 * so it is safe to retry by default. Methods outside this set (POST, PUT,
 * PATCH, DELETE and anything unrecognized) may already have applied a side
 * effect when the attempt failed, so they are not retried unless the caller
 * asks for it.
 */
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export class BaseResource {
  readonly options: ClientOptions;
  protected readonly apiPrefix: string;

  constructor(options: ClientOptions) {
    this.options = options;
    this.apiPrefix = normalizeRoutePath(options.apiPrefix ?? '/api');
  }

  /**
   * Retry count for a request that only reads server state even though its HTTP method is not a
   * read method, such as a query sent as POST. It keeps the read default unless the client was
   * configured with an explicit `retries` count, which always wins.
   */
  protected readRetries(): number {
    return this.options.retries ?? DEFAULT_RETRIES;
  }

  /**
   * Makes an HTTP request to the API with retries and exponential backoff
   * @param path - The API endpoint path (without prefix, e.g., '/agents')
   * @param options - Optional request configuration
   * @returns Promise containing the response data
   */
  public async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    let lastError: Error | null = null;
    const {
      baseUrl,
      retries: configuredRetries,
      backoffMs = 100,
      maxBackoffMs = 1000,
      headers = {},
      credentials,
      fetch: customFetch,
    } = this.options;
    const { retries: requestRetries, ...fetchOptions } = options;
    // Only read requests retry by default. A retry of a write can duplicate a side
    // effect the server already applied, so writes are sent once unless the caller
    // opts in with an explicit retry count on the client or the call.
    const method = (fetchOptions.method ?? 'GET').toUpperCase();
    const retries = requestRetries ?? configuredRetries ?? (READ_METHODS.has(method) ? DEFAULT_RETRIES : 0);
    if (!Number.isSafeInteger(retries) || retries < 0) {
      throw new RangeError('retries must be a non-negative safe integer');
    }
    const signal = mergeAbortSignals(this.options.abortSignal, fetchOptions.signal);
    const fetchFn = customFetch || fetch;

    let delay = backoffMs;

    const fullPath = `${this.apiPrefix}${path}`;

    for (let attempt = 0; attempt <= retries; attempt++) {
      if (signal?.aborted) {
        throw signal.reason ?? new DOMException('This operation was aborted', 'AbortError');
      }
      try {
        const response = await fetchFn(`${baseUrl.replace(/\/$/, '')}${fullPath}`, {
          ...fetchOptions,
          headers: mergeHeaders(
            fetchOptions.body &&
              !(fetchOptions.body instanceof FormData) &&
              (fetchOptions.method === 'POST' ||
                fetchOptions.method === 'PUT' ||
                fetchOptions.method === 'PATCH' ||
                fetchOptions.method === 'DELETE')
              ? { 'content-type': 'application/json' }
              : undefined,
            headers,
            fetchOptions.headers,
            // TODO: Bring this back once we figure out what we/users need to do to make this work with cross-origin requests
            // { 'x-mastra-client-type': 'js' },
          ),
          signal,
          credentials: fetchOptions.credentials ?? credentials,
          body:
            fetchOptions.body instanceof FormData
              ? fetchOptions.body
              : fetchOptions.body
                ? JSON.stringify(fetchOptions.body)
                : undefined,
        });

        if (!response.ok) {
          const errorBody = await response.text();
          let parsedBody: unknown;
          let errorMessage = `HTTP error! status: ${response.status}`;
          try {
            parsedBody = JSON.parse(errorBody);
            errorMessage += ` - ${JSON.stringify(parsedBody)}`;
          } catch {
            if (errorBody) {
              errorMessage += ` - ${errorBody}`;
            }
          }
          throw new MastraClientError(response.status, response.statusText, errorMessage, parsedBody);
        }

        if (options.stream) {
          return response as unknown as T;
        }

        const data = await response.json();
        return data as T;
      } catch (error) {
        lastError = error as Error;

        // Aborted requests must not be retried
        if (signal?.aborted || (error as Error)?.name === 'AbortError') {
          throw error;
        }

        // Don't retry 4xx client errors, 501 Not Implemented, or trace query execution
        // timeouts - they won't resolve with retries
        if (isTerminalHttpError(error) || isTraceQueryTimeoutError(error)) {
          throw error;
        }

        if (attempt === retries) {
          break;
        }

        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
          }, delay);
          const onAbort = () => {
            clearTimeout(timer);
            reject(signal?.reason ?? new DOMException('This operation was aborted', 'AbortError'));
          };
          signal?.addEventListener('abort', onAbort, { once: true });
        });
        delay = Math.min(delay * 2, maxBackoffMs);
      }
    }

    throw lastError || new Error('Request failed');
  }
}
