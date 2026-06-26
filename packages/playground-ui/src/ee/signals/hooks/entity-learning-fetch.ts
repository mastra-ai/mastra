type QueryValue = string | number | boolean | null | undefined;

/**
 * Org/project scoping for entity-learning requests. The gateway/output-service
 * routes are organization + project scoped, so these are sent as headers when
 * available.
 */
export interface EntityLearningScope {
  organizationId?: string;
  projectId?: string;
}

/**
 * Fetches a direct `/entity-learning/*` route from the Mastra platform.
 *
 * Builds `${endpoint}/entity-learning${path}` with query params (skipping
 * null/undefined), sends credentials plus optional `x-organization-id` /
 * `x-project-id` scoping headers, and throws on non-OK so React Query surfaces
 * the failure via `error`.
 */
export async function entityLearningFetch<TResponse>(
  endpoint: string,
  path: string,
  params?: Record<string, QueryValue>,
  scope?: EntityLearningScope,
): Promise<TResponse> {
  const url = new URL(`${endpoint.replace(/\/$/, '')}/entity-learning${path}`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === null || value === undefined) continue;
      url.searchParams.set(key, String(value));
    }
  }

  const headers: Record<string, string> = {};
  if (scope?.organizationId) headers['x-organization-id'] = scope.organizationId;
  if (scope?.projectId) headers['x-project-id'] = scope.projectId;

  const response = await fetch(url.toString(), { credentials: 'include', headers });

  if (!response.ok) {
    throw new Error(`Entity learning request failed (${response.status}) for ${path}`);
  }

  return (await response.json()) as TResponse;
}
