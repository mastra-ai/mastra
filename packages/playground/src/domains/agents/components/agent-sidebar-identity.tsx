import type { GetAgentResponse } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { ChevronLeft } from 'lucide-react';
import { ContextualSidebarHeader } from '@/components/ui/contextual-sidebar-header';
import { ContextualSidebarSection } from '@/components/ui/contextual-sidebar-section';

export function AgentSidebarIdentity({ agent }: { agent: GetAgentResponse }) {
  const { Link, paths } = useLinkComponent();
  const model = agent.modelList?.find(model => model.enabled !== false)?.model.modelId || agent.modelId;
  return (
    <div className="shrink-0 border-b border-border">
      <ContextualSidebarHeader>
        <Button variant="ghost" size="sm" icon={<ChevronLeft />} render={<Link href={paths.agentsLink()} />}>
          All agents
        </Button>
      </ContextualSidebarHeader>
      <ContextualSidebarSection>
        <nav aria-label="Active agent" className="min-w-0">
          <Txt as="h2" variant="meta" tone="muted" className="px-3 pb-2">
            Active agent
          </Txt>
          <Sidebar.NavList>
            <Sidebar.NavLink
              state="default"
              link={{ name: agent.name, url: paths.agentLink(agent.id), icon: <AgentIcon /> }}
              isActive
            />
          </Sidebar.NavList>
          {model && (
            <Txt variant="caption" tone="muted" className="px-3 pt-2 break-words">
              {model}
            </Txt>
          )}
        </nav>
      </ContextualSidebarSection>
    </div>
  );
}
