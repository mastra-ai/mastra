import type { RequestOptions, ClientOptions } from '../types';
import { MastraClientError } from '../types';
import { normalizeRoutePath } from '../utils';

export class BaseResource {
  readonly options: ClientOptions;
  protected readonly apiPrefix: string;

  constructor(options: ClientOptions) {
    this.options = options;
    this.apiPrefix = normalizeRoutePath(options.apiPrefix ?? '/api');
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
      retries = 3,
      backoffMs = 100,
      maxBackoffMs = 1000,
      headers = {},
      credentials,
      fetch: customFetch,
    } = this.options;
    const fetchFn = customFetch || fetch;

    let delay = backoffMs;

    const fullPath = `${this.apiPrefix}${path}`;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetchFn(`${baseUrl.replace(/\/$/, '')}${fullPath}`, {
          ...options,
          headers: {
            ...(options.body &&
            !(options.body instanceof FormData) &&
            (options.method === 'POST' ||
              options.method === 'PUT' ||
              options.method === 'PATCH' ||
              options.method === 'DELETE')
              ? { 'content-type': 'application/json' }
              : {}),
            ...headers,
            ...options.headers,
            // TODO: Bring this back once we figure out what we/users need to do to make this work with cross-origin requests
            // 'x-mastra-client-type': 'js',
          },
          signal: this.options.abortSignal,
          credentials: options.credentials ?? credentials,
          body:
            options.body instanceof FormData ? options.body : options.body ? JSON.stringify(options.body) : undefined,
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

        if (attempt === retries) {
          break;
        }

        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * 2, maxBackoffMs);
      }
    }

    throw lastError || new Error('Request failed');
  }
}
