import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useToolAgents } from '../hooks/use-tool-agents';
import { ToolAgentLink } from './tool-agent-link';
import { ToolCurrentAgent } from './tool-current-agent';

export interface ToolUsedByListProps {
  toolId: string;
  currentAgentId?: string;
}

export function ToolUsedByList({ toolId, currentAgentId }: ToolUsedByListProps) {
  const { agents, isLoading, isError } = useToolAgents(toolId, currentAgentId);

  if (isLoading) return <Skeleton className="h-8 w-full" />;

  // Checked before the empty state: a failed request says nothing about which agents use the tool.
  if (isError) {
    return (
      <Txt variant="caption" tone="muted">
        Couldn't load the agents that use this tool.
      </Txt>
    );
  }

  if (agents.length === 0) {
    return (
      <Txt variant="caption" tone="muted">
        No agents use this tool.
      </Txt>
    );
  }

  return (
    <ul className="-mx-2 grid gap-0.5">
      {agents.map(agent => (
        <li key={agent.id}>
          {agent.id === currentAgentId ? (
            <ToolCurrentAgent name={agent.name} />
          ) : (
            <ToolAgentLink agentId={agent.id} name={agent.name} />
          )}
        </li>
      ))}
    </ul>
  );
}
