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
import { AgentWorkingMemory } from './agent-working-memory';
import { AgentPromptEnhancer } from './agent-instructions-enhancer';

export function AgentInformation({ agentId }: { agentId: string }) {
  const { agent, isLoading } = useAgent(agentId);
  const { memory, isLoading: isMemoryLoading } = useMemory(agentId);

  return (
    <div className="grid grid-rows-[auto_1fr] h-full items-start overflow-y-auto border-l-sm border-border1">
      <AgentEntityHeader agentId={agentId} isLoading={isMemoryLoading} agentName={agent?.name || ''} />

      <div className="overflow-y-auto border-t-sm border-border1">
        <PlaygroundTabs defaultTab="overview">
          <TabList>
            <Tab value="overview">Overview</Tab>
            <Tab value="model-settings">Model Settings</Tab>
            <Tab value="logs">Log Drains</Tab>
            <Tab value="working-memory">Working Memory</Tab>
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

          <TabContent value="logs">
            {isLoading ? <Skeleton className="h-full" /> : <AgentLogs agentId={agentId} />}
          </TabContent>
          <TabContent value="working-memory">
            {isLoading ? <Skeleton className="h-full" /> : <AgentWorkingMemory />}
          </TabContent>
        </PlaygroundTabs>
      </div>
    </div>
  );
}
