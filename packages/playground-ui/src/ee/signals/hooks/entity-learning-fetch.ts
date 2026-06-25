type QueryValue = string | number | boolean | null | undefined;

/**
 * Fetches a direct `/entity-learning/*` route from the Mastra platform.
 *
 * Builds `${endpoint}/entity-learning${path}` with query params (skipping
 * null/undefined), sends credentials, and throws on non-OK so React Query
 * surfaces the failure via `error`.
 */
export async function entityLearningFetch<TResponse>(
  endpoint: string,
  path: string,
  params?: Record<string, QueryValue>,
): Promise<TResponse> {
  const url = new URL(`${endpoint.replace(/\/$/, '')}/entity-learning${path}`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === null || value === undefined) continue;
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url.toString(), { credentials: 'include' });

  if (!response.ok) {
    throw new Error(`Entity learning request failed (${response.status}) for ${path}`);
  }

  return (await response.json()) as TResponse;
}
