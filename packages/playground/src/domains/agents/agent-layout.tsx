import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { useState } from 'react';
import { useMatch, useParams } from 'react-router';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { AgentConfigToggle } from '@/domains/agents/components/agent-config-toggle';
import { AgentDetailHeaderActions } from '@/domains/agents/components/agent-detail-header-actions';
import { AgentNavigationToggle } from '@/domains/agents/components/agent-navigation-toggle';
import { useIsAgentChat } from '@/domains/chat/hooks/use-is-agent-chat';
import { agentCrumb, navCrumb } from '@/domains/navigation/crumbs';
import { AgentToolDrawerBody } from '@/domains/tools/components/tool-drawer/agent-tool-drawer-body';
import { ToolDrawer } from '@/domains/tools/components/tool-drawer/tool-drawer';

const agentCrumbs = [navCrumb('/agents'), agentCrumb];
const chatCrumbs = [navCrumb('/chat'), agentCrumb];

export const AgentLayout = ({ children }: { children: React.ReactNode }) => {
  const { agentId } = useParams();
  const isChat = useIsAgentChat();
  const activeView = useMatch('/agents/:agentId/:view/*')?.params.view;
  const viewHasHeading = activeView === 'overview' || activeView === 'configuration';
  const [chatContainer, setChatContainer] = useState<HTMLDivElement | null>(null);

  return (
    <>
      <ToolDrawer>
        <AgentToolDrawerBody agentId={agentId!} />
      </ToolDrawer>
      <PageLayout
        variant="fit"
        breadcrumbs={<PageBreadcrumbs crumbs={isChat ? chatCrumbs : agentCrumbs} />}
        headerActions={
          <>
            <AgentNavigationToggle />
            <AgentDetailHeaderActions agentId={agentId!} />
          </>
        }
        primaryActions={isChat && chatContainer && <AgentConfigToggle agentId={agentId!} container={chatContainer} />}
      >
        {!viewHasHeading && <h1 className="sr-only">{agentId}</h1>}
        <div
          ref={setChatContainer}
          data-testid="agent-chat-canvas"
          className="relative grid h-full min-h-0 min-w-0 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)]"
        >
          {children}
        </div>
      </PageLayout>
    </>
  );
};
