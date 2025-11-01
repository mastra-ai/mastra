/**
 * Fetches a URL with retry logic
 * @param url The URL to fetch
 * @param options Fetch options
 * @param maxRetries Maximum number of retry attempts
 * @returns The fetch Response if successful
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries: number = 3,
): Promise<Response> {
  let retryCount = 0;
  let lastError: Error | null = null;

  while (retryCount < maxRetries) {
    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        // Only retry on server errors (5xx) or network failures
        // Don't retry on client errors (4xx)
        if (response.status >= 400 && response.status < 500) {
          throw new Error(`Request failed with status: ${response.status} ${response.statusText}`);
        }

        lastError = new Error(`Request failed with status: ${response.status} ${response.statusText}`);
        retryCount++;

        if (retryCount >= maxRetries) {
          throw lastError;
        }

        const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // If it's a client error (4xx), don't retry
      if (lastError.message.includes('status: 4')) {
        throw lastError;
      }

      retryCount++;

      if (retryCount >= maxRetries) {
        break;
      }

      const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Request failed after multiple retry attempts');
}
