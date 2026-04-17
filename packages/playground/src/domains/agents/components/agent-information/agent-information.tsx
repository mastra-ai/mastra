import { Tabs, Tab, TabContent, TabList } from '@mastra/playground-ui';
import { useState, useCallback } from 'react';
import { useBrowserSession } from '../../context/browser-session-context';
import { useAgent } from '../../hooks/use-agent';
import { AgentEntityHeader } from '../agent-entity-header';
import { AgentMetadata } from '../agent-metadata';
import { AgentSettings } from '../agent-settings';
import { BrowserSidebarTab } from '../browser-view/browser-sidebar-tab';
import { AgentMemory } from './agent-memory';
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
  const { hasSession, isInSidebar } = useBrowserSession();
  const hasMemory = !isMemoryLoading && Boolean(memory?.result);

  const { selectedTab, handleTabChange } = useAgentInformationTab({
    isMemoryLoading,
    hasMemory,
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

          <TabContent value="tracing-options">
            <TracingRunOptions />
          </TabContent>
        </Tabs>
      </div>
    </AgentInformationLayout>
  );
}

const STORAGE_KEY = 'agent-info-selected-tab';

export interface UseAgentInformationTabArgs {
  isMemoryLoading: boolean;
  hasMemory: boolean;
}

// Valid tab values that can be persisted
const VALID_TABS = new Set(['overview', 'model-settings', 'memory', 'request-context', 'tracing-options']);

export const useAgentInformationTab = ({ isMemoryLoading, hasMemory }: UseAgentInformationTabArgs) => {
  const [selectedTab, setSelectedTab] = useState<string>(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY) || 'overview';
    // Validate stored tab is a known valid tab
    if (!VALID_TABS.has(stored)) return 'overview';
    return stored;
  });

  // Compute effective tab - handle unavailable tabs
  const effectiveTab = (() => {
    // Unknown tab values fall back to overview
    if (!VALID_TABS.has(selectedTab)) return 'overview';
    // Memory tab requires memory to be available
    if (selectedTab === 'memory' && !isMemoryLoading && !hasMemory) {
      return 'overview';
    }
    return selectedTab;
  })();

  const handleTabChange = useCallback((value: string) => {
    setSelectedTab(value);
    sessionStorage.setItem(STORAGE_KEY, value);
  }, []);

  return {
    selectedTab: effectiveTab,
    handleTabChange,
  };
};

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
  const hasMemory = Boolean(memory?.result);

  const { selectedTab, handleTabChange } = useAgentInformationTab({
    isMemoryLoading,
    hasMemory,
  });

  return (
    <div className="flex-1 overflow-hidden border-t border-border1 flex flex-col min-w-0 w-full">
      <Tabs defaultTab="overview" value={selectedTab} onValueChange={handleTabChange}>
        {children}
      </Tabs>
    </div>
  );
};
