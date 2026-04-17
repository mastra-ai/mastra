/** Extract `metadata.avatarUrl` or fall back to the top-level avatarUrl. */
export function resolveAgentAvatar(agent: {
  avatarUrl?: string;
  metadata?: Record<string, unknown>;
}): string | undefined {
  if (agent.avatarUrl) return agent.avatarUrl;
  const fromMetadata = agent.metadata?.avatarUrl;
  return typeof fromMetadata === 'string' ? fromMetadata : undefined;
}
