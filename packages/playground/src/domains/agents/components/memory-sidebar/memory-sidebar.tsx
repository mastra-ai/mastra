import type { StorageThreadType } from '@mastra/core/memory';
import { Tabs, Tab, TabContent, TabList } from '@mastra/playground-ui';
import { Brain } from 'lucide-react';
import { ChatThreads } from '@/domains/agents/components/chat-threads';
import { AgentMemory } from '@/domains/agents/components/agent-information/agent-memory';
import { useMemorySidebarTab } from './use-memory-sidebar-tab';

export interface MemorySidebarProps {
  agentId: string;
  threadId: string;
  threads?: StorageThreadType[];
  isLoading: boolean;
  onDelete: (threadId: string) => void;
  memoryType?: 'local' | 'gateway';
}

export function MemorySidebar({ agentId, threadId, threads, isLoading, onDelete, memoryType }: MemorySidebarProps) {
  const { selectedTab, handleTabChange } = useMemorySidebarTab();

  return (
    <div className="h-full w-full min-w-0 p-2">
      <div className="bg-surface3 rounded-studio-panel border border-border1/50 flex h-full min-h-0 flex-col overflow-hidden">
        <Tabs defaultTab="threads" value={selectedTab} onValueChange={handleTabChange} className="flex h-full flex-col">
          <div className="shrink-0">
            <div className="flex items-center gap-2 px-4 pt-4">
              <Brain className="h-4 w-4 text-neutral5" />
              <h2 className="text-sm font-medium text-neutral5">Memory</h2>
            </div>
            <TabList>
              <Tab value="threads">Threads</Tab>
              <Tab value="configuration">Configuration</Tab>
            </TabList>
          </div>

          <TabContent value="threads" className="min-h-0 flex-1 overflow-y-auto py-0">
            <ChatThreads
              resourceId={agentId}
              resourceType="agent"
              threads={threads || []}
              isLoading={isLoading}
              threadId={threadId}
              onDelete={onDelete}
              embedded
            />
          </TabContent>

          <TabContent value="configuration" className="min-h-0 flex-1 overflow-y-auto">
            <AgentMemory agentId={agentId} threadId={threadId} memoryType={memoryType} />
          </TabContent>
        </Tabs>
      </div>
    </div>
  );
}
