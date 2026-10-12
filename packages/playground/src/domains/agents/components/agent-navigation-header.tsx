import { Button } from '@mastra/playground-ui/components/Button';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { useAgents } from '@mastra/react/hooks/agents';
import { Info } from 'lucide-react';
import { useNavigate } from 'react-router';
import { AgentCombobox } from './agent-combobox';
import { AgentSidebarIdentity } from './agent-sidebar-identity';
import { ContextualSidebarHeader } from '@/components/ui/contextual-sidebar-header';

/** Chat switches agents from one combobox, which lists pinned and recent agents first, and opens the agent's details beside it. */
export function AgentNavigationHeader({ agentId, view }: { agentId: string; view: 'chat' | 'agent' }) {
  const { data: agents, isLoading } = useAgents();
  const navigate = useNavigate();
  const { Link, paths } = useLinkComponent();
  if (view === 'agent') {
    if (isLoading) return <Skeleton className="m-3 h-24 shrink-0" />;
    return agents?.[agentId] ? <AgentSidebarIdentity agent={agents[agentId]} /> : null;
  }
  return (
    <ContextualSidebarHeader>
      <AgentCombobox
        value={agentId}
        onValueChange={id => void navigate(`/chat/${encodeURIComponent(id)}`)}
        variant="ghost"
        size="sm"
        className="w-full"
        aria-label="Switch agent"
      />
      <Button
        variant="ghost"
        size="icon-sm"
        className="shrink-0"
        aria-label="Agent details"
        tooltip="Agent details"
        render={<Link href={paths.agentLink(agentId)} />}
      >
        <Info />
      </Button>
    </ContextualSidebarHeader>
  );
}
