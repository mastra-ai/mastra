/**
 * Performs a fetch request with automatic retries using exponential backoff
 * @param url The URL to fetch from
 * @param options Standard fetch options
 * @param maxRetries Maximum number of retry attempts
 * @param validateResponse Optional function to validate the response beyond HTTP status
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
        throw new Error(`Request failed with status: ${response.status} ${response.statusText}`);
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      retryCount++;

      if (retryCount >= maxRetries) {
        break;
      }

      const delay = Math.min(1000 * Math.pow(2, retryCount) * 1000, 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Request failed after multiple retry attempts');
}
