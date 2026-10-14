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
 * Resolves the resource rung of a Subconscious Knowledge scope. A `project:` agent
 * scope anchors it so a host (for example, the Factory) can share one graph across
 * runs of the same project, leaving thread identity untouched. Only scopes Core marked
 * as run-derived count: any in-process caller can write the raw key, and this scope
 * moves Knowledge across identities. Cores without `getRunAgentScopes` cannot vouch,
 * so the project scope is ignored there (fail closed).
 */
export function resolveKnowledgeResourceId(
  requestContext: ContextReader,
  fallback: string | undefined,
): string | undefined {
  const getRunAgentScopes = (coreAgent as { getRunAgentScopes?: (rc: unknown) => string[] | undefined })
    .getRunAgentScopes;
  const [projectId] = scopeValues(getRunAgentScopes?.(requestContext), 'project');
  return projectId ?? fallback;
}
