import type { StorageThreadType } from '@mastra/core/memory';
import { AgentThreadSidebar } from '@mastra/playground-ui/domains/agents/chat/memory-sidebar/agent-thread-sidebar';
import { getObservationWindowTokens } from '@mastra/playground-ui/domains/agents/chat/memory-sidebar/lib/observation-window';
import type { OmAgentConfig } from '@mastra/playground-ui/domains/agents/chat/memory-sidebar/lib/observation-window';
import { useMemoryFeatureFlags } from '@mastra/playground-ui/domains/agents/chat/memory-sidebar/use-memory-feature-flags';
import { SidebarPanel } from '@mastra/playground-ui/domains/agents/chat/sidebar-panel';
import { useEntityRequestContext } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import { useObservationalMemory, useMemoryConfig, useThread, useMemory } from '@mastra/react/hooks/memory';
import { AgentCapabilitiesFooter } from './agent-capabilities-footer';
import { AgentMemory } from './agent-memory';
import { MemoryDetailView } from './memory-detail-view';
import { ChatThreads } from '@/domains/agents/components/chat-threads';
import { useMemoryTimeline, useObservationalMemoryContext } from '@/domains/agents/context';

export interface MemorySidebarProps {
  agentId: string;
  threadId: string;
  threads?: StorageThreadType[];
  onDelete?: (threadId: string) => void;
  threadsSlot?: React.ReactNode;
  isThreadsLoading?: boolean;
}

export function MemorySidebar(props: MemorySidebarProps) {
  return (
    <SidebarPanel>
      <MemorySidebarBody {...props} />
    </SidebarPanel>
  );
}

export function MemorySidebarBody({
  agentId,
  threadId,
  threads,
  onDelete,
  threadsSlot,
  isThreadsLoading,
}: MemorySidebarProps) {
  const requestContext = useEntityRequestContext('agent', agentId)[0];
  const { data: memory } = useMemory({
    agentId,
    requestContext,
    queryOptions: { enabled: Boolean(agentId) },
  });
  const { isPanelOpen } = useMemoryTimeline();
  const { streamProgress } = useObservationalMemoryContext();
  const { observationalOn } = useMemoryFeatureFlags(agentId);

  const liveProgress = streamProgress?.threadId === threadId ? streamProgress : null;
  const { data: thread } = useThread({
    threadId,
    agentId,
    requestContext,
    queryOptions: { enabled: Boolean(threadId) && threadId !== 'new' && Boolean(agentId) },
  });
  const { data: memoryConfigData } = useMemoryConfig({
    agentId,
    requestContext,
    queryOptions: { enabled: Boolean(agentId) },
  });
  const { data: omData } = useObservationalMemory({
    agentId: observationalOn ? agentId : undefined,
    threadId: observationalOn ? threadId : undefined,
    resourceId: thread?.resourceId ?? agentId,
  });
  const omAgentConfig = (memoryConfigData?.config as { observationalMemory?: OmAgentConfig } | undefined)
    ?.observationalMemory;
  const { messageTokens, messageThreshold } = getObservationWindowTokens({
    record: omData?.record,
    liveProgress,
    agentConfig: omAgentConfig,
  });
  const hasObservationWindow = Boolean(liveProgress) || Boolean(omData?.record);
  const observationPercent =
    hasObservationWindow && messageThreshold > 0
      ? Math.min(100, Math.round((messageTokens / messageThreshold) * 100))
      : undefined;

  return (
    <AgentThreadSidebar
      agentId={agentId}
      threadList={
        threadsSlot ?? (
          <ChatThreads
            key={agentId}
            resourceId={agentId}
            resourceType="agent"
            threads={threads ?? []}
            threadId={threadId}
            onDelete={onDelete ?? (() => {})}
            embedded
            isLoading={isThreadsLoading}
          />
        )
      }
      observationPercent={observationPercent}
      memoryContent={<AgentMemory agentId={agentId} threadId={threadId} memoryType={memory?.memoryType} />}
      memoryDetail={
        observationalOn && isPanelOpen ? <MemoryDetailView agentId={agentId} threadId={threadId} /> : undefined
      }
      footer={<AgentCapabilitiesFooter agentId={agentId} />}
    />
  );
}
