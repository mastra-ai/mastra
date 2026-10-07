export interface FetchWithRetryOptions {
  shouldRetryResponse?: (response: Response) => boolean;
}

const defaultShouldRetryResponse = () => true;

/**
 * Performs a fetch request with automatic retries using exponential backoff.
 * Network failures are always retried. Non-OK responses are retried unless
 * `shouldRetryResponse` returns false. Aborting `options.signal` stops retries
 * immediately and rejects with the signal's reason.
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries: number = 3,
  retryOptions: FetchWithRetryOptions = {},
): Promise<Response> {
  let retryCount = 0;
  let lastError: Error | null = null;
  const shouldRetryResponse = retryOptions.shouldRetryResponse ?? defaultShouldRetryResponse;
  const signal = options.signal ?? undefined;

  while (retryCount < maxRetries) {
    signal?.throwIfAborted();

    let response: Response | undefined;

    try {
      response = await fetch(url, options);
    } catch (error) {
      if (signal?.aborted) {
        throw signal.reason;
      }
      lastError = error instanceof Error ? error : new Error(String(error));
    }

    if (response) {
      if (!response.ok) {
        lastError = new Error(`Request failed with status: ${response.status} ${response.statusText}`);

        if (!shouldRetryResponse(response)) {
          throw lastError;
        }
      } else {
        return response;
      }
    }

    retryCount++;

    if (retryCount >= maxRetries) {
      break;
    }

    const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
    await new Promise<void>((resolve, reject) => {
      const onAbort = () => {
        clearTimeout(timer);
        reject(signal!.reason);
      };
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      }, delay);
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  throw lastError || new Error('Request failed after multiple retry attempts');
}
