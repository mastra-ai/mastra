import { ScrollArea, Tabs, Tab, TabContent, TabList } from '@mastra/playground-ui';
import { useBrowserSession } from '../../context/browser-session-context';
import { useAgent } from '../../hooks/use-agent';
import { AgentEntityHeader } from '../agent-entity-header';
import { AgentMetadata } from '../agent-metadata';
import { BrowserSidebarTab } from '../browser-view/browser-sidebar-tab';
import { useAgentInformationTab } from './use-agent-information-tab';
import { TracingRunOptions } from '@/domains/observability/components/tracing-run-options';
import { RequestContextSchemaForm } from '@/domains/request-context';

export interface AgentInformationProps {
  agentId: string;
}

export function AgentInformation({ agentId }: AgentInformationProps) {
  const { data: agent } = useAgent(agentId);
  const { hasSession, isInSidebar } = useBrowserSession();

  const { selectedTab, handleTabChange } = useAgentInformationTab();

  return (
    <AgentInformationLayout>
      <ScrollArea className="h-full w-full" viewPortClassName="h-full" mask={{ top: false }}>
        <Tabs defaultTab="overview" value={selectedTab} onValueChange={handleTabChange} className="overflow-y-visible">
          <div className="sticky top-0 z-10 bg-surface3">
            <AgentEntityHeader agentId={agentId} />
            <TabList>
              <Tab value="overview">Overview</Tab>
              {agent?.requestContextSchema && <Tab value="request-context">Request Context</Tab>}
              <Tab value="tracing-options">Tracing Options</Tab>
            </TabList>
          </div>

          <div className="relative">
            {/* Browser sidebar overlay - takes over when in sidebar mode */}
            {hasSession && isInSidebar && (
              <div className="absolute inset-0 z-20 bg-surface3">
                <BrowserSidebarTab />
              </div>
            )}

            <TabContent value="overview">
              <AgentMetadata agentId={agentId} />
            </TabContent>

            {agent?.requestContextSchema && (
              <TabContent value="request-context">
                <div className="p-5">
                  <RequestContextSchemaForm requestContextSchema={agent.requestContextSchema} />
                </div>
              </TabContent>
            )}

            <TabContent value="tracing-options">
              <TracingRunOptions />
            </TabContent>
          </div>
        </Tabs>
      </ScrollArea>
    </AgentInformationLayout>
  );
}

export interface AgentInformationLayoutProps {
  children: React.ReactNode;
}

export const AgentInformationLayout = ({ children }: AgentInformationLayoutProps) => {
  return (
    <div className="h-full w-full pb-2 pr-2">
      <div className="h-full min-w-0 w-full bg-surface3 rounded-studio-panel border border-border1 overflow-hidden">
        {children}
      </div>
    </div>
  );
};

export interface AgentInformationTabLayoutProps {
  children: React.ReactNode;
}
export const AgentInformationTabLayout = ({ children }: AgentInformationTabLayoutProps) => {
  const { selectedTab, handleTabChange } = useAgentInformationTab();

  return (
    <div className="flex-1 overflow-hidden border-t border-border1 flex flex-col min-w-0 w-full">
      <Tabs defaultTab="overview" value={selectedTab} onValueChange={handleTabChange}>
        {children}
      </Tabs>
    </div>
  );
};
