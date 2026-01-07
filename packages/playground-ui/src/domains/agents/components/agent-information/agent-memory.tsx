import { AgentWorkingMemory } from './agent-working-memory';
import { AgentMemoryConfig } from './agent-memory-config';
import { useMemo } from 'react';
import { MemoryExplorer } from '@/domains/memory/components/memory-explorer';
import { useThreads } from '@/domains/memory/hooks';
import { useMemory } from '@/domains/memory/hooks';

export type AgentMemoryProps = {
  agentId: string;
  threadId: string;
};

export function AgentMemory({ agentId, threadId }: AgentMemoryProps) {
  // Get memory status
  const { data: memoryStatus } = useMemory(agentId);
  const isMemoryEnabled = Boolean(memoryStatus?.result);

  // Get threads to find current thread data
  const { data: threads } = useThreads({
    resourceId: agentId,
    agentId,
    isMemoryEnabled,
  });

  // Find the current thread
  const currentThread = useMemo(() => {
    if (!threads || !threadId) return null;
    return threads.find(t => t.id === threadId) ?? null;
  }, [threads, threadId]);

  return (
    <MemoryExplorer
      agentId={agentId}
      threadId={threadId}
      thread={currentThread}
      defaultTab="messages"
      className="h-full"
      WorkingMemoryComponent={AgentWorkingMemory}
      MemoryConfigComponent={AgentMemoryConfig}
    />
  );
}
