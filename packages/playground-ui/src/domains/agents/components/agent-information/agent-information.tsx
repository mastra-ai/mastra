import { Skeleton } from '@/components/ui/skeleton';

import { AgentMemory } from './agent-memory';
import { useState, useEffect } from 'react';
import { AgentEntityHeader } from '../agent-entity-header';
import { PlaygroundTabs, Tab, TabContent, TabList } from '@/components/ui/playground-tabs';
import { AgentMetadata } from '../agent-metadata';
import { useAgent } from '../../hooks/use-agent';
import { useMemory } from '@/domains/memory/hooks';
import { useAgentSettings } from '../../context/agent-context';
import { AgentSettings } from '../agent-settings';

export interface AgentInformationProps {
  agentId: string;
  threadId: string;
}

export function AgentInformation({ agentId, threadId }: AgentInformationProps) {
  const { data: agent, isLoading } = useAgent(agentId);
  const { data: memory, isLoading: isMemoryLoading } = useMemory(agentId);
  const hasMemory = Boolean(memory?.result);

  return (
    <AgentInformationLayout modelId={agent?.modelId}>
      <AgentEntityHeader agentId={agentId} isLoading={isMemoryLoading} agentName={agent?.name || ''} />

      <AgentInformationTabLayout isMemoryLoading={isMemoryLoading} hasMemory={hasMemory}>
        <TabList>
          <Tab value="overview">Overview</Tab>
          <Tab value="model-settings">Model Settings</Tab>
          {hasMemory && <Tab value="memory">Memory</Tab>}
        </TabList>
        <TabContent value="overview">
          {isLoading && <Skeleton className="h-full" />}
          {agent && (
            <AgentMetadata
              agentId={agentId}
              agent={agent}
              hasMemoryEnabled={hasMemory}
              modelVersion={agent.modelVersion}
            />
          )}
        </TabContent>
        <TabContent value="model-settings">
          {isLoading && <Skeleton className="h-full" />}
          {agent && (
            <AgentSettings
              modelVersion={agent.modelVersion}
              hasMemory={hasMemory}
              hasSubAgents={Boolean(Object.keys(agent.agents || {}).length > 0)}
            />
          )}
        </TabContent>
        <TabContent value="memory">
          {isLoading ? <Skeleton className="h-full" /> : <AgentMemory agentId={agentId} threadId={threadId} />}
        </TabContent>
      </AgentInformationTabLayout>
    </AgentInformationLayout>
  );
}

const STORAGE_KEY = 'agent-info-selected-tab';

export interface UseAgentInformationTabArgs {
  isMemoryLoading: boolean;
  hasMemory: boolean;
}
export const useAgentInformationTab = ({ isMemoryLoading, hasMemory }: UseAgentInformationTabArgs) => {
  const [selectedTab, setSelectedTab] = useState<string>(() => {
    return sessionStorage.getItem(STORAGE_KEY) || 'overview';
  });

  const handleTabChange = (value: string) => {
    setSelectedTab(value);
    sessionStorage.setItem(STORAGE_KEY, value);
  };

  // Switch away from memory tab if memory is disabled (not just loading)
  useEffect(() => {
    if (!isMemoryLoading && !hasMemory && selectedTab === 'memory') {
      // Switch to overview tab if memory is disabled
      setSelectedTab('overview');
      sessionStorage.setItem(STORAGE_KEY, 'overview');
    }
  }, [isMemoryLoading, hasMemory, selectedTab]);

  return {
    selectedTab,
    handleTabChange,
  };
};

export interface UseAgentInformationSettingsArgs {
  modelId: string;
}

export const useAgentInformationSettings = ({ modelId }: UseAgentInformationSettingsArgs) => {
  const { settings, setSettings } = useAgentSettings();

  useEffect(() => {
    if (modelId?.includes('gpt-5')) {
      setSettings({
        ...(settings || {}),
        modelSettings: {
          ...(settings?.modelSettings || {}),
          temperature: 1,
        },
      });
    }
  }, [modelId]);

  return {
    settings,
    setSettings,
  };
};

export interface AgentInformationLayoutProps {
  children: React.ReactNode;
  modelId?: string;
}

export const AgentInformationLayout = ({ children, modelId }: AgentInformationLayoutProps) => {
  useAgentInformationSettings({ modelId: modelId || '' });

  return (
    <div className="grid grid-rows-[auto_1fr] h-full items-start overflow-y-auto border-l-sm border-border1">
      {children}
    </div>
  );
};

export interface AgentInformationTabLayoutProps {
  children: React.ReactNode;
  isMemoryLoading: boolean;
  hasMemory: boolean;
}
export const AgentInformationTabLayout = ({ children, isMemoryLoading, hasMemory }: AgentInformationTabLayoutProps) => {
  const { selectedTab, handleTabChange } = useAgentInformationTab({
    isMemoryLoading,
    hasMemory,
  });

  return (
    <div className="flex-1 overflow-hidden border-t-sm border-border1 flex flex-col">
      <PlaygroundTabs defaultTab="overview" value={selectedTab} onValueChange={handleTabChange}>
        {children}
      </PlaygroundTabs>
    </div>
  );
};
