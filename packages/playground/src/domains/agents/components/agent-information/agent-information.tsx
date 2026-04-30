import { Tabs, Tab, TabContent, TabList } from '@mastra/playground-ui';
import { useBrowserSession } from '../../context/browser-session-context';
import { useAgent } from '../../hooks/use-agent';
import { useChannelPlatforms } from '../../hooks/use-channels';
import { AgentChannels } from '../agent-channels';
import { AgentEntityHeader } from '../agent-entity-header';
import { AgentMetadata } from '../agent-metadata';
import { AgentSettings } from '../agent-settings';
import { BrowserSidebarTab } from '../browser-view/browser-sidebar-tab';
import { AgentMemory } from './agent-memory';
import { useAgentInformationTab } from './use-agent-information-tab';
import { useMemory } from '@/domains/memory/hooks';
import { TracingRunOptions } from '@/domains/observability/components/tracing-run-options';
import { RequestContextSchemaForm } from '@/domains/request-context';

export interface AgentInformationProps {
  agentId: string;
  threadId: string;
}

export function AgentInformation({ agentId, threadId }: AgentInformationProps) {
  const { data: agent } = useAgent(agentId);
  const { data: memory, isLoading: isMemoryLoading } = useMemory(agentId);
  const { data: platforms } = useChannelPlatforms();
  const { hasSession, isInSidebar } = useBrowserSession();
  const hasMemory = !isMemoryLoading && Boolean(memory?.result);
  const hasChannels = Boolean(platforms && platforms.length > 0);

  const { selectedTab, handleTabChange } = useAgentInformationTab({
    isMemoryLoading,
    hasMemory,
    hasChannels,
  });

  return (
    <AgentInformationLayout>
      <AgentEntityHeader agentId={agentId} />

      <div className="flex-1 overflow-hidden border-t border-border1 flex flex-col relative">
        {/* Browser sidebar overlay - takes over when in sidebar mode */}
        {hasSession && isInSidebar && (
          <div className="absolute inset-0 z-10 bg-surface1">
            <BrowserSidebarTab />
          </div>
        )}

        {/* Normal tabs - always rendered but hidden when browser overlay is active */}
        <Tabs defaultTab="overview" value={selectedTab} onValueChange={handleTabChange}>
          <TabList>
            <Tab value="overview">Overview</Tab>
            <Tab value="model-settings">Model Settings</Tab>
            {hasMemory && <Tab value="memory">Memory</Tab>}
            {hasChannels && <Tab value="channels">Channels</Tab>}
            {agent?.requestContextSchema && <Tab value="request-context">Request Context</Tab>}
            <Tab value="tracing-options">Tracing Options</Tab>
          </TabList>
          <TabContent value="overview">
            <AgentMetadata agentId={agentId} />
          </TabContent>
          <TabContent value="model-settings">
            <AgentSettings agentId={agentId} />
          </TabContent>

          {agent?.requestContextSchema && (
            <TabContent value="request-context">
              <div className="p-5">
                <RequestContextSchemaForm requestContextSchema={agent.requestContextSchema} />
              </div>
            </TabContent>
          )}

          {hasMemory && (
            <TabContent value="memory">
              <AgentMemory agentId={agentId} threadId={threadId} memoryType={memory?.memoryType} />
            </TabContent>
          )}

          {hasChannels && (
            <TabContent value="channels">
              <AgentChannels agentId={agentId} />
            </TabContent>
          )}

          <TabContent value="tracing-options">
            <TracingRunOptions />
          </TabContent>
        </Tabs>
      </div>
    </AgentInformationLayout>
  );
}

export interface AgentInformationLayoutProps {
  children: React.ReactNode;
}

export const AgentInformationLayout = ({ children }: AgentInformationLayoutProps) => {
  return (
    <div className="grid grid-rows-[auto_1fr] h-full items-start overflow-y-auto overflow-x-hidden min-w-0 w-full">
      {children}
    </div>
  );
};

export interface AgentInformationTabLayoutProps {
  children: React.ReactNode;
  agentId: string;
}
export const AgentInformationTabLayout = ({ children, agentId }: AgentInformationTabLayoutProps) => {
  const { data: memory, isLoading: isMemoryLoading } = useMemory(agentId);
  const { data: platforms } = useChannelPlatforms();
  const hasMemory = Boolean(memory?.result);
  const hasChannels = Boolean(platforms && platforms.length > 0);

  const { selectedTab, handleTabChange } = useAgentInformationTab({
    isMemoryLoading,
    hasMemory,
    hasChannels,
  });

  return (
    <div className="flex-1 overflow-hidden border-t border-border1 flex flex-col min-w-0 w-full">
      <Tabs defaultTab="overview" value={selectedTab} onValueChange={handleTabChange}>
        {children}
      </Tabs>
    </div>
  );
};
