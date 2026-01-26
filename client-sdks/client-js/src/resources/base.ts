import type { RequestOptions, ClientOptions } from '../types';

/**
 * Normalizes a route prefix to ensure it has a leading slash and no trailing slash.
 * @param prefix - The prefix to normalize
 * @returns Normalized prefix (e.g., '/api', '/mastra')
 */
function normalizePrefix(prefix: string): string {
  let normalized = prefix.trim();
  // Add leading slash if missing
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }
  // Remove trailing slash if present
  if (normalized.endsWith('/') && normalized.length > 1) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

export class BaseResource {
  readonly options: ClientOptions;
  protected readonly prefix: string;

  constructor(options: ClientOptions) {
    this.options = options;
    this.prefix = normalizePrefix(options.prefix ?? '/api');
  }

  /**
   * Paths that should NOT have the API prefix applied (protocol-specific paths).
   * These are special protocol endpoints that exist at the root level.
   */
  private static readonly NON_API_PATH_PREFIXES = ['/a2a/', '/.well-known/'];

  /**
   * Checks if a path should have the API prefix applied.
   * Returns false for protocol-specific paths like /a2a/ and /.well-known/
   */
  private shouldApplyPrefix(path: string): boolean {
    return !BaseResource.NON_API_PATH_PREFIXES.some(prefix => path.startsWith(prefix));
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

    // Build the full URL with prefix (unless it's a protocol-specific path)
    const fullPath = this.shouldApplyPrefix(path) ? `${this.prefix}${path}` : path;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetchFn(`${baseUrl.replace(/\/$/, '')}${fullPath}`, {
          ...options,
          headers: {
            ...(options.body &&
            !(options.body instanceof FormData) &&
            (options.method === 'POST' || options.method === 'PUT')
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
          let errorMessage = `HTTP error! status: ${response.status}`;
          try {
            const errorJson = JSON.parse(errorBody);
            errorMessage += ` - ${JSON.stringify(errorJson)}`;
          } catch {
            if (errorBody) {
              errorMessage += ` - ${errorBody}`;
            }
          }
          throw new Error(errorMessage);
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
