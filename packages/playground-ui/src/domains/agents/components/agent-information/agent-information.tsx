import { Skeleton } from '@/components/ui/skeleton';

import { AgentMemory } from './agent-memory';
import { useState, useEffect } from 'react';
import { AgentEntityHeader } from '../agent-entity-header';
import { PlaygroundTabs, Tab, TabContent, TabList } from '@/components/ui/playground-tabs';
import { AgentMetadata } from '../agent-metadata';
import { useAgent } from '../../hooks/use-agent';
import {
  useReorderModelList,
  useResetAgentModel,
  useUpdateAgentModel,
  useUpdateModelInModelList,
} from '../../hooks/use-agents';
import { useMemory } from '@/domains/memory/hooks';
import { useAgentSettings } from '../../context/agent-context';
import { AgentSettings } from '../agent-settings';

export interface AgentInformationProps {
  agentId: string;
  threadId: string;
}

export function AgentInformation({ agentId, threadId }: AgentInformationProps) {
  const { data: agent, isLoading } = useAgent(agentId);
  const { mutateAsync: updateModel } = useUpdateAgentModel(agentId);
  const { mutateAsync: resetModel } = useResetAgentModel(agentId);
  const { mutate: reorderModelList } = useReorderModelList(agentId);
  const { mutateAsync: updateModelInModelList } = useUpdateModelInModelList(agentId);
  const { data: memory, isLoading: isMemoryLoading } = useMemory(agentId);
  const { settings, setSettings } = useAgentSettings();

  // Persist tab selection
  const STORAGE_KEY = 'agent-info-selected-tab';
  const [selectedTab, setSelectedTab] = useState<string>(() => {
    return sessionStorage.getItem(STORAGE_KEY) || 'overview';
  });

  const handleTabChange = (value: string) => {
    setSelectedTab(value);
    sessionStorage.setItem(STORAGE_KEY, value);
  };

  useEffect(() => {
    if (agent?.modelId?.includes('gpt-5')) {
      setSettings({
        ...(settings || {}),
        modelSettings: {
          ...(settings?.modelSettings || {}),
          temperature: 1,
        },
      });
    }
  }, [agent]);

  // Switch away from memory tab if memory is disabled (not just loading)
  useEffect(() => {
    if (!isMemoryLoading && !memory?.result && selectedTab === 'memory') {
      // Switch to overview tab if memory is disabled
      handleTabChange('overview');
    }
  }, [isMemoryLoading, memory?.result, selectedTab]);

  return (
    <div className="grid grid-rows-[auto_1fr] h-full items-start overflow-y-auto border-l-sm border-border1">
      <AgentEntityHeader agentId={agentId} isLoading={isMemoryLoading} agentName={agent?.name || ''} />

      <div className="flex-1 overflow-hidden border-t-sm border-border1 flex flex-col">
        <PlaygroundTabs defaultTab="overview" value={selectedTab} onValueChange={handleTabChange}>
          <TabList>
            <Tab value="overview">Overview</Tab>
            <Tab value="model-settings">Model Settings</Tab>
            {memory?.result && <Tab value="memory">Memory</Tab>}
          </TabList>
          <TabContent value="overview">
            {isLoading && <Skeleton className="h-full" />}
            {agent && (
              <AgentMetadata
                agentId={agentId}
                agent={agent}
                updateModel={updateModel}
                resetModel={resetModel}
                updateModelInModelList={updateModelInModelList}
                reorderModelList={reorderModelList}
                hasMemoryEnabled={Boolean(memory?.result)}
                modelVersion={agent.modelVersion}
              />
            )}
          </TabContent>
          <TabContent value="model-settings">
            {isLoading && <Skeleton className="h-full" />}
            {agent && (
              <AgentSettings
                modelVersion={agent.modelVersion}
                hasMemory={Boolean(memory?.result)}
                hasSubAgents={Boolean(Object.keys(agent.agents || {}).length > 0)}
              />
            )}
          </TabContent>
          <TabContent value="memory">
            {isLoading ? <Skeleton className="h-full" /> : <AgentMemory agentId={agentId} threadId={threadId} />}
          </TabContent>
        </PlaygroundTabs>
      </div>
    </div>
  );
}
