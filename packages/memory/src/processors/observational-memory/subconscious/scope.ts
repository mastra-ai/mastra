import * as coreAgent from '@mastra/core/agent';

type ContextReader = { get?(key: string): unknown } | undefined;

// Read by string so this package keeps its older Core peer floor.
const AGENT_SCOPES_KEY = 'mastra__scopes';

export const MISSING_ORG_MESSAGE =
  'Knowledge needs an org:<id> agent scope (or the legacy organizationId request-context key).';

function scopeValues(scopes: unknown, type: string): string[] {
  if (!Array.isArray(scopes)) return [];
  const prefix = `${type}:`;
  return scopes
    .filter((scope): scope is string => typeof scope === 'string' && scope.startsWith(prefix))
    .map(scope => scope.slice(prefix.length).trim())
    .filter(Boolean);
}

/**
 * Resolves the Knowledge org from the run's `org:` agent scope, with the legacy
 * `organizationId` request-context key as fallback. Returns undefined when neither
 * is set. Throws when the run names more than one org, when the two sources
 * disagree, or when the id contains `:` (it would forge a deeper scope address).
 */
export function resolveKnowledgeOrgId(requestContext: ContextReader): string | undefined {
  const orgs = new Set(scopeValues(requestContext?.get?.(AGENT_SCOPES_KEY), 'org'));
  const legacy = requestContext?.get?.('organizationId');
  if (typeof legacy === 'string' && legacy.trim()) orgs.add(legacy.trim());
  if (orgs.size > 1) {
    throw new Error(
      `Subconscious needs one org, but the run holds ${orgs.size}: ${[...orgs].map(org => `org:${org}`).join(', ')}. ` +
        'An org scope must match the organizationId request-context key when both are set.',
    );
  }
  const [organizationId] = orgs;
  if (organizationId?.includes(':')) {
    throw new Error(`Subconscious org ids cannot contain ':' (got ${organizationId}).`);
  }
  return organizationId;
}

/**
 * Resolves the middle rung of a Subconscious Knowledge scope. A `project:` agent scope
 * gives the rung its own `project:<id>` address so a host (for example, the Factory)
 * can share one graph across a project's sessions without colliding with a user
 * resource that happens to share the id. Only scopes Core marked as run-derived count:
 * any in-process caller can write the raw key, and this scope moves Knowledge across
 * identities. Cores without `getRunAgentScopes` cannot vouch, so the project scope is
 * ignored there (fail closed) and the rung falls back to `resource:<fallback>`.
 */
export function resolveKnowledgeRung(
  requestContext: ContextReader,
  fallbackResourceId: string | undefined,
): { address: string; parameters: Record<string, string> } | undefined {
  const getRunAgentScopes = (coreAgent as { getRunAgentScopes?: (rc: unknown) => string[] | undefined })
    .getRunAgentScopes;
  const [projectId] = scopeValues(getRunAgentScopes?.(requestContext), 'project');
  if (projectId) return { address: `project:${projectId}`, parameters: { projectId } };
  if (!fallbackResourceId) return undefined;
  return { address: `resource:${fallbackResourceId}`, parameters: { resourceId: fallbackResourceId } };
}
