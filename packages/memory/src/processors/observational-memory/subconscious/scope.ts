/**
 * Resolves the resource rung of a subconscious knowledge scope.
 *
 * When the request context carries the reserved
 * `mastra__knowledgeResourceId` override, every
 * scope resolver anchors the resource rung on it instead of the run's
 * resourceId. This lets a host (for example, the factory) share one knowledge
 * graph across many runs of the same project while leaving thread identity and
 * observational memory untouched. Without the override, behavior is unchanged:
 * the fallback (the run's resourceId) is used as-is.
 *
 * The key is reserved (`mastra__` prefix) so the server drops it from HTTP
 * request bodies: only trusted host middleware can set it. A plain key would let
 * a caller anchor Knowledge on a resource their authorization never checked.
 */
export const KNOWLEDGE_RESOURCE_ID_KEY = 'mastra__knowledgeResourceId';

export function resolveKnowledgeResourceId(
  requestContext: { get?(key: string): unknown } | undefined,
  fallback: string | undefined,
): string | undefined {
  const override = requestContext?.get?.(KNOWLEDGE_RESOURCE_ID_KEY);
  if (typeof override === 'string' && override.trim()) return override;
  return fallback;
}
