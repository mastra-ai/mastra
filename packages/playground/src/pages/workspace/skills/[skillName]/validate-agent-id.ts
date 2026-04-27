/**
 * Validate an agentId from the URL against a cached agents map.
 * Returns the agentId if it exists in the cache, otherwise null.
 */
export function validateAgentId(
  decodedAgentId: string | null,
  cachedAgents: Record<string, unknown> | null | undefined,
): string | null {
  if (decodedAgentId == null || cachedAgents == null) return null;
  return decodedAgentId in cachedAgents ? decodedAgentId : null;
}
