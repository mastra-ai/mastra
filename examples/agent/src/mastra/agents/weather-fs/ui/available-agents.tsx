import { useAgents } from '@mastra/react/hooks/agents';

const PREVIEW_COUNT = 5;

function hue(name: string) {
  return [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360;
}

/**
 * Reads the agent list through Studio's own Mastra client and query cache.
 */
export function AvailableAgents() {
  const { data: agentNames } = useAgents({
    queryOptions: {
      // Reuse the list Studio already loaded instead of refetching on every card mount.
      staleTime: 60_000,
      select: agents => Object.values(agents).map(agent => agent.name),
    },
  });

  if (!agentNames) return null;

  const hidden = agentNames.length - PREVIEW_COUNT;

  return (
    <div className="wx-agents">
      <div className="wx-avatars">
        {agentNames.slice(0, PREVIEW_COUNT).map((name, index) => (
          <span
            key={name}
            className="wx-avatar"
            title={name}
            style={{
              '--i': index,
              background: `linear-gradient(135deg, hsl(${hue(name)} 85% 60%), hsl(${hue(name) + 40} 80% 45%))`,
            }}
          >
            {name.charAt(0).toUpperCase()}
          </span>
        ))}
        {hidden > 0 && (
          <span className="wx-avatar wx-more" style={{ '--i': PREVIEW_COUNT }}>
            +{hidden}
          </span>
        )}
      </div>
      <span className="wx-meta">{agentNames.length} agents on this server</span>
    </div>
  );
}
