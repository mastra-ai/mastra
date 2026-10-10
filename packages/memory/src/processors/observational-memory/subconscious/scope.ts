/**
 * Resolves the resource rung of a subconscious knowledge scope.
 *
 * When the request context carries a `knowledgeResourceId` override, every
 * scope resolver anchors the resource rung on it instead of the run's
 * resourceId. This lets a host (for example, the factory) share one knowledge
 * graph across many runs of the same project while leaving thread identity and
 * observational memory untouched. Without the override, behavior is unchanged:
 * the fallback (the run's resourceId) is used as-is.
 */
export function resolveKnowledgeResourceId(
  requestContext: { get?(key: string): unknown } | undefined,
  fallback: string | undefined,
): string | undefined {
  const override = requestContext?.get?.('knowledgeResourceId');
  if (typeof override === 'string' && override.trim()) return override;
  return fallback;
}

// Mirrors MASTRA_SCOPES_KEY in @mastra/core. Read by string so this package keeps its older Core peer floor.
const AGENT_SCOPES_KEY = 'mastra__scopes';

type ScopeRequestContext = { get?(key: string): unknown } | undefined;

/**
 * The parent run's resolved scopes (`<type>:<value>` addresses). The run that resolves scopes
 * publishes only non-identity scopes here; resource and thread come from the run itself.
 */
export function getAgentScopes(requestContext: ScopeRequestContext): string[] {
  const scopes = requestContext?.get?.(AGENT_SCOPES_KEY);
  return Array.isArray(scopes) ? scopes.filter((scope): scope is string => typeof scope === 'string') : [];
}

/**
 * Resolves the org Subconscious writes Knowledge under.
 *
 * An `org:<id>` agent scope wins. Without one, the legacy `organizationId` request-context key is
 * used. Returns undefined when neither is present: Knowledge needs an org for now, so Subconscious
 * skips that run. Throws when the run holds more than one distinct org scope.
 */
export function resolveSubconsciousOrgId(
  requestContext: ScopeRequestContext,
  debug?: (message: string) => void,
): string | undefined {
  const orgIds = [
    ...new Set(
      getAgentScopes(requestContext)
        .filter(scope => scope.startsWith('org:'))
        .map(scope => scope.slice('org:'.length))
        .filter(Boolean),
    ),
  ];
  if (orgIds.length > 1) {
    throw new Error(
      `Subconscious needs one org scope, but the run holds ${orgIds.length}: ${orgIds.map(id => `org:${id}`).join(', ')}.`,
    );
  }

  const legacy = requestContext?.get?.('organizationId');
  const legacyOrgId = typeof legacy === 'string' && legacy.trim() ? legacy : undefined;
  const [scopedOrgId] = orgIds;
  if (scopedOrgId) {
    if (legacyOrgId && legacyOrgId !== scopedOrgId) {
      debug?.(
        `[Subconscious] org scope "org:${scopedOrgId}" differs from organizationId "${legacyOrgId}"; using the org scope.`,
      );
    }
    return scopedOrgId;
  }
  return legacyOrgId;
}

export const MISSING_ORG_SCOPE_MESSAGE =
  'Knowledge needs an org:<id> agent scope (or the legacy organizationId request-context key) for now.';
