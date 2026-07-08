import { QueryClient } from '@tanstack/react-query';

/**
 * Factory for the app's React Query client. Kept in `shared` so the web entry
 * and a future React Native entry construct an identically-configured client.
 *
 * - `retry: false` — the settings endpoints are local/server-of-record; a
 *   failure should surface immediately, not after silent retries.
 * - `refetchOnWindowFocus: false` — settings don't change out from under the
 *   user often enough to justify refetching every time the tab regains focus.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
        staleTime: 30_000,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
