/**
 * Network utilities for OAuth flow.
 *
 * Provides fetch wrapper with single retry for transient network errors.
 *
 * @internal This module is not exported from the main package.
 */

import { AuthError } from '../error';

/**
 * Fetch with single retry on network errors.
 *
 * Retries ONLY on network failures (fetch throws), not HTTP error responses.
 * Caller is responsible for handling HTTP status codes.
 *
 * @param url - URL to fetch
 * @param options - Fetch options
 * @returns Response (may have error status code)
 * @throws AuthError with code 'network_error' if both attempts fail
 */
export async function fetchWithRetry(url: string, options: RequestInit): Promise<Response> {
  try {
    return await fetch(url, options);
  } catch {
    // Network error - retry once
    try {
      return await fetch(url, options);
    } catch (retryError) {
      // Both attempts failed
      throw AuthError.networkError(retryError instanceof Error ? retryError : undefined);
    }
  }
}
