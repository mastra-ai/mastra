import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { useAgents } from '@mastra/react/hooks/agents';
import { useParams } from 'react-router';
import { useAgentLinkInCurrentView } from '../hooks/use-agent-link-in-current-view';
import { useAgentPins } from '../hooks/use-agent-pins';
import { PinnableAgentLink } from './pinnable-agent-link';
import { ContextualSidebarSection } from '@/components/ui/contextual-sidebar-section';

/** The list stays while an agent is open; picking another agent keeps the open view. */
export function AgentsSidebarList({ search }: { search: string }) {
  const { data: agents, isLoading } = useAgents();
  const { pinnedAgentIds, toggleAgentPin } = useAgentPins();
  const agentLink = useAgentLinkInCurrentView();
  const { agentId: openAgentId } = useParams();
  if (isLoading) return <Skeleton className="m-3 h-24 shrink-0" />;

  const matching = Object.values(agents ?? {}).filter(agent =>
    agent.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const pinnedAgents = pinnedAgentIds.flatMap(id => matching.find(agent => agent.id === id) ?? []);
  const otherAgents = matching.filter(agent => !pinnedAgentIds.includes(agent.id));

  return (
    <ContextualSidebarSection>
      <Sidebar.Nav aria-label="Agents list">
        {pinnedAgents.length > 0 && (
          <Sidebar.NavSection>
            <Sidebar.NavHeader state="default">Pinned</Sidebar.NavHeader>
            <Sidebar.NavList>
              {pinnedAgents.map(agent => (
                <PinnableAgentLink
                  key={agent.id}
                  agent={agent}
                  url={agentLink(agent.id)}
                  isActive={agent.id === openAgentId}
                  pinned
                  onTogglePin={() => toggleAgentPin(agent.id)}
                />
              ))}
            </Sidebar.NavList>
          </Sidebar.NavSection>
        )}
        <Sidebar.NavSection>
          <Sidebar.NavHeader state="default">All agents</Sidebar.NavHeader>
          <Sidebar.NavList>
            {otherAgents.map(agent => (
              <PinnableAgentLink
                key={agent.id}
                agent={agent}
                url={agentLink(agent.id)}
                isActive={agent.id === openAgentId}
                pinned={false}
                onTogglePin={() => toggleAgentPin(agent.id)}
              />
            ))}
          </Sidebar.NavList>
          {matching.length === 0 && <p className="text-ui-sm px-3 py-2 text-muted-foreground">No agents found.</p>}
        </Sidebar.NavSection>
      </Sidebar.Nav>
    </ContextualSidebarSection>
  );
}
