import type { StorageThreadType } from '@mastra/core/memory';
import { Tabs, Tab, TabContent, TabList, EmptyState, Button } from '@mastra/playground-ui';
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
  hasMemory: boolean;
}

export function MemorySidebar({
  agentId,
  threadId,
  threads,
  isLoading,
  onDelete,
  memoryType,
  hasMemory,
}: MemorySidebarProps) {
  const { selectedTab, handleTabChange } = useMemorySidebarTab();

  return (
    <div className="h-full w-full min-w-0 p-2">
      <div className="bg-surface3 rounded-studio-panel border border-border1/50 flex h-full min-h-0 flex-col overflow-hidden">
        {hasMemory ? (
          <Tabs
            defaultTab="threads"
            value={selectedTab}
            onValueChange={handleTabChange}
            className="flex h-full flex-col"
          >
            <div className="shrink-0">
              <TabList>
                <Tab value="threads">Threads</Tab>
                <Tab value="configuration">Memory Configuration</Tab>
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

            <TabContent value="configuration" className="min-h-0 flex-1 overflow-y-auto py-0">
              <AgentMemory agentId={agentId} threadId={threadId} memoryType={memoryType} />
            </TabContent>
          </Tabs>
        ) : (
          <EmptyState
            iconSlot={null}
            titleSlot="Memory not enabled"
            descriptionSlot="Conversations are only saved as threads when the agent has memory configured."
            actionSlot={
              <Button
                as="a"
                href="https://mastra.ai/en/docs/agents/agent-memory"
                target="_blank"
                rel="noopener noreferrer"
                variant="outline"
              >
                View documentation
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
}
