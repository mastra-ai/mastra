import { useAgents } from '@mastra/react/hooks/agents';

const PREVIEW_COUNT = 5;

/**
 * Reads the agent list through Studio's own Mastra client and query cache.
 */
export function AvailableAgents() {
  const { data: agentNames, isLoading } = useAgents({
    queryOptions: {
      // Reuse the list Studio already loaded instead of refetching on every card mount.
      staleTime: 60_000,
      select: agents => Object.values(agents).map(agent => agent.name),
    },
  });

  if (isLoading) return <small>Loading agents…</small>;
  if (!agentNames) return null;

  const hidden = agentNames.length - PREVIEW_COUNT;

  return (
    <div style={{ marginTop: 12 }}>
      <small>{agentNames.length} agents on this server</small>
      <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
        {agentNames.slice(0, PREVIEW_COUNT).map(name => (
          <li key={name}>{name}</li>
        ))}
        {hidden > 0 && <li>and {hidden} more</li>}
      </ul>
    </div>
  );
}
