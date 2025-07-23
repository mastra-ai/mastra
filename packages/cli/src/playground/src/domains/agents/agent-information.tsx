import { useAgent } from '@/hooks/use-agents';
import { AgentLogs } from './agent-logs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AgentSettings,
  PlaygroundTabs,
  Tab,
  TabContent,
  TabList,
  AgentMetadata,
  AgentEntityHeader,
} from '@mastra/playground-ui';

import { useMemory } from '@/hooks/use-memory';
import { AgentMemory } from './agent-memory';
import { useState, useEffect } from 'react';
import { AgentPromptEnhancer } from './agent-instructions-enhancer';

export function AgentInformation({ agentId, chatInputValue }: { agentId: string; chatInputValue?: string }) {
  const { agent, isLoading } = useAgent(agentId);
  const { memory, isLoading: isMemoryLoading } = useMemory(agentId);

  // Persist tab selection
  const STORAGE_KEY = 'agent-info-selected-tab';
  const [selectedTab, setSelectedTab] = useState<string>(() => {
    return sessionStorage.getItem(STORAGE_KEY) || 'overview';
  });

  const handleTabChange = (value: string) => {
    setSelectedTab(value);
    sessionStorage.setItem(STORAGE_KEY, value);
  };

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
        <PlaygroundTabs value={selectedTab} onValueChange={handleTabChange}>
          <TabList>
            <Tab value="overview">Overview</Tab>
            <Tab value="model-settings">Model Settings</Tab>
            {memory?.result && <Tab value="memory">Memory</Tab>}
            <Tab value="logs">Log Drains</Tab>
          </TabList>
          <TabContent value="overview">
            {isLoading && <Skeleton className="h-full" />}
            {agent && (
              <AgentMetadata
                agent={agent}
                hasMemoryEnabled={Boolean(memory?.result)}
                computeToolLink={tool => `/tools/${agentId}/${tool.id}`}
                computeWorkflowLink={workflow => `/workflows/${workflow.name}/graph`}
                promptSlot={<AgentPromptEnhancer agentId={agentId} />}
              />
            )}
          </TabContent>
          <TabContent value="model-settings">
            {isLoading && <Skeleton className="h-full" />}
            {agent && <AgentSettings />}
          </TabContent>
          <TabContent value="memory">
            {isLoading ? (
              <Skeleton className="h-full" />
            ) : (
              <AgentMemory agentId={agentId} chatInputValue={selectedTab === 'memory' ? chatInputValue : undefined} />
            )}
          </TabContent>
          <TabContent value="logs">
            {isLoading ? <Skeleton className="h-full" /> : <AgentLogs agentId={agentId} />}
          </TabContent>
        </PlaygroundTabs>
      </div>
    </div>
  );
}
