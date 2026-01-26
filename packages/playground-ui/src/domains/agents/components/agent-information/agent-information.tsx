import { AgentMemory } from './agent-memory';
import { useState, useEffect } from 'react';
import { AgentEntityHeader } from '../agent-entity-header';
import { Tabs, Tab, TabContent, TabList } from '@/ds/components/Tabs';
import { AgentMetadata } from '../agent-metadata';
import { useAgent } from '../../hooks/use-agent';
import { useMemory } from '@/domains/memory/hooks';
import { useAgentSettings } from '../../context/agent-context';
import { AgentSettings } from '../agent-settings';
import { TracingRunOptions } from '@/domains/observability/components/tracing-run-options';
import { RequestContextSchemaForm } from '@/domains/request-context';
import { cn } from '@/lib/utils';

export interface AgentInformationProps {
  agentId: string;
  threadId: string;
}

export function AgentInformation({ agentId, threadId }: AgentInformationProps) {
  const { data: agent } = useAgent(agentId);
  const { data: memory, isLoading: isMemoryLoading } = useMemory(agentId);
  const hasMemory = !isMemoryLoading && Boolean(memory?.result);

  const { selectedTab, handleTabChange } = useAgentInformationTab({
    isMemoryLoading,
    hasMemory,
  });

  return (
    <AgentInformationLayout agentId={agentId}>
      <AgentEntityHeader agentId={agentId} />

      <div className="flex-1 overflow-hidden border-t border-border1 flex flex-col">
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
          {hasMemory && (
            <TabContent value="memory">
              <AgentMemory agentId={agentId} threadId={threadId} />
            </TabContent>
          )}
          {/* Keep RequestContextSchemaForm mounted to preserve state, use CSS to show/hide */}
          {agent?.requestContextSchema && (
            <div className={cn('p-5', selectedTab !== 'request-context' && 'hidden')}>
              <RequestContextSchemaForm requestContextSchema={agent.requestContextSchema} />
            </div>
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
  agentId?: string;
}

export const AgentInformationLayout = ({ children, agentId }: AgentInformationLayoutProps) => {
  const { data: agent } = useAgent(agentId);
  useAgentInformationSettings({ modelId: agent?.modelId || '' });

  return <div className="grid grid-rows-[auto_1fr] h-full items-start overflow-y-auto">{children}</div>;
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
    <div className="flex-1 overflow-hidden border-t border-border1 flex flex-col">
      <Tabs defaultTab="overview" value={selectedTab} onValueChange={handleTabChange}>
        {children}
      </Tabs>
    </div>
  );
};
