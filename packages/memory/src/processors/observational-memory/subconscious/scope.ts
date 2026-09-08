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
