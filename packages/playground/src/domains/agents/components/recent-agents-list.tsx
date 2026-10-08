import type { GetAgentResponse } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { ChevronDown, ChevronLeft, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { useRecentAgentIds } from '../hooks/use-recent-agent-ids';
import { ContextualSidebarHeader } from '@/components/ui/contextual-sidebar-header';
import { ContextualSidebarSection } from '@/components/ui/contextual-sidebar-section';

export function RecentAgentsList({
  agentId,
  agents,
  userId,
  view,
}: {
  agentId: string;
  agents: Record<string, GetAgentResponse>;
  userId?: string;
  view: 'chat' | 'agent';
}) {
  const recentIds = useRecentAgentIds(agentId, userId);
  const [expanded, setExpanded] = useState(false);
  const { Link, paths } = useLinkComponent();
  const recentAgents = recentIds.flatMap(id => agents[id] ?? []);
  const visibleAgents = expanded ? recentAgents : recentAgents.slice(0, 3);

  return (
    <ScrollArea maxHeight="40vh" className="shrink-0 border-b border-border" mask={false}>
      <ContextualSidebarHeader>
        <Button
          variant="ghost"
          size="sm"
          icon={<ChevronLeft />}
          render={<Link href={view === 'chat' ? '/chat/agents' : paths.agentsLink()} />}
        >
          All agents
        </Button>
      </ContextualSidebarHeader>
      <ContextualSidebarSection>
        <nav aria-label="Recent agents">
          <Txt as="h2" variant="meta" tone="muted" className="px-3 pb-2">
            Recent agents
          </Txt>
          <Sidebar.NavList>
            {visibleAgents.map(agent => (
              <Sidebar.NavLink
                key={agent.id}
                state="default"
                link={{
                  name: agent.name,
                  url: view === 'chat' ? `/chat/${encodeURIComponent(agent.id)}` : paths.agentLink(agent.id),
                  icon: <AgentIcon />,
                }}
                isActive={agent.id === agentId}
              />
            ))}
          </Sidebar.NavList>
          {recentAgents.length > 3 ? (
            <Button
              variant="ghost"
              size="sm"
              icon={expanded ? <ChevronUp /> : <ChevronDown />}
              aria-expanded={expanded}
              onClick={() => setExpanded(value => !value)}
              className="mt-1"
            >
              {expanded ? 'Show less' : 'Show more'}
            </Button>
          ) : null}
        </nav>
      </ContextualSidebarSection>
    </ScrollArea>
  );
}
