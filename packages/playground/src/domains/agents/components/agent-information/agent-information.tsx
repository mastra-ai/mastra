/* eslint-disable react-refresh/only-export-components */
import {
  Card,
  IconButton,
  Icon,
  Tabs,
  Tab,
  TabContent,
  TabList,
  Txt,
  useCollapsiblePanel,
} from '@mastra/playground-ui';
import { X } from 'lucide-react';
import { useState, useCallback } from 'react';
import { useBrowserSession } from '../../context/browser-session-context';
import { usePanelVisibility } from '../../context/use-panel-visibility';
import { useAgent } from '../../hooks/use-agent';
import { AgentMetadata } from '../agent-metadata';
import { BrowserSidebarTab } from '../browser-view/browser-sidebar-tab';
import { AgentMemory } from './agent-memory';
import { useMemory } from '@/domains/memory/hooks';
import { RequestContextSchemaForm } from '@/domains/request-context';

export interface AgentInformationProps {
  agentId: string;
  threadId: string;
}

export function AgentInformation({ agentId, threadId }: AgentInformationProps) {
  const { data: agent } = useAgent(agentId);
  const { data: memory, isLoading: isMemoryLoading } = useMemory(agentId);
  const { hasSession, isInSidebar } = useBrowserSession();
  const { visibility } = usePanelVisibility();

  const hasMemory = !isMemoryLoading && Boolean(memory?.result);
  const hasRequestContext = Boolean(agent?.requestContextSchema);

  const showOverview = visibility.overview;
  const showMemory = visibility.memory && hasMemory;
  const hasAnyContent = showOverview || showMemory || hasRequestContext;

  return (
    <AgentInformationLayout>
      <div className="flex-1 overflow-hidden flex flex-col relative">
        {/* Browser sidebar overlay - takes over when in sidebar mode */}
        {hasSession && isInSidebar && (
          <div className="absolute inset-0 z-10 bg-surface1">
            <BrowserSidebarTab />
          </div>
        )}

        {/* Panel sections - rendered based on toggle visibility */}
        <div className="flex flex-col overflow-y-auto flex-1">
          {showOverview && <AgentMetadata agentId={agentId} />}

          {showMemory && <AgentMemory agentId={agentId} threadId={threadId} memoryType={memory?.memoryType} />}

          {/* Request Context tab - kept as tab since it's a different interaction pattern */}
          {hasRequestContext && (
            <div className="border-t border-border1">
              <Tabs defaultTab="request-context">
                <TabList>
                  <Tab value="request-context">Request Context</Tab>
                </TabList>
                <TabContent value="request-context">
                  <div className="p-5">
                    <RequestContextSchemaForm requestContextSchema={agent!.requestContextSchema!} />
                  </div>
                </TabContent>
              </Tabs>
            </div>
          )}

          {/* Empty state when no panels visible */}
          {!hasAnyContent && (
            <div className="flex items-center justify-center h-full p-4">
              <Txt variant="ui-sm" className="text-neutral3 text-center">
                Use toggle buttons in the top bar to show panels
              </Txt>
            </div>
          )}
        </div>
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
const VALID_TABS = new Set(['overview', 'memory', 'request-context']);

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
  const { collapse } = useCollapsiblePanel();
  return (
    <div className="h-full p-4">
      <Card elevation="flat" as="aside" className="grid h-full w-full grid-rows-[auto_1fr] overflow-hidden min-w-0">
        <div className="flex items-center justify-end border-b border-border1 px-2 py-1.5">
          <IconButton variant="ghost" size="sm" tooltip="Close panel" onClick={collapse}>
            <Icon>
              <X />
            </Icon>
          </IconButton>
        </div>
        <div className="min-h-0 overflow-y-auto overflow-x-hidden">{children}</div>
      </Card>
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
