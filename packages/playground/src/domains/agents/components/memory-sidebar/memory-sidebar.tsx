import type { StorageThreadType } from '@mastra/core/memory';
import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { getObservationWindowTokens } from '@mastra/playground-ui/domains/agents/chat/memory-sidebar/lib/observation-window';
import type { OmAgentConfig } from '@mastra/playground-ui/domains/agents/chat/memory-sidebar/lib/observation-window';
import { useMemoryFeatureFlags } from '@mastra/playground-ui/domains/agents/chat/memory-sidebar/use-memory-feature-flags';
import { useMemorySidebarTab } from '@mastra/playground-ui/domains/agents/chat/memory-sidebar/use-memory-sidebar-tab';
import { SidebarPanel } from '@mastra/playground-ui/domains/agents/chat/sidebar-panel';
import { MemorySidebarView } from '@mastra/playground-ui/domains/memory/components/memory-sidebar-view';
import { useEntityRequestContext } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import { IconSquareArrowTopRight } from '@mastra/playground-ui/icons/central/IconSquareArrowTopRight';
import { useObservationalMemory, useMemoryConfig, useThread, useMemory } from '@mastra/react/hooks/memory';
import { AgentCapabilitiesFooter } from './agent-capabilities-footer';
import { AgentMemory } from './agent-memory';
import { MemoryDetailView } from './memory-detail-view';
import './memory-sidebar.css';
import { ChatThreads } from '@/domains/agents/components/chat-threads';
import { useMemoryTimeline, useObservationalMemoryContext } from '@/domains/agents/context';

export interface MemorySidebarProps {
  agentId: string;
  threadId: string;
  threads?: StorageThreadType[];
  onDelete?: (threadId: string) => void;
  /** When provided, rendered as the thread layer instead of the built-in ChatThreads list. */
  threadsSlot?: React.ReactNode;
  /** Forwarded to ChatThreads; keeps its header in place while the list loads. */
  isThreadsLoading?: boolean;
}

// SidebarPanel is the single layout shell; the body picks the view with guard
// clauses and returns bare content — see structure-early-return-render-branches.
export function MemorySidebar({
  agentId,
  threadId,
  threads,
  onDelete,
  threadsSlot,
  isThreadsLoading,
}: MemorySidebarProps) {
  return (
    <SidebarPanel>
      <MemorySidebarBody
        agentId={agentId}
        threadId={threadId}
        threads={threads}
        onDelete={onDelete}
        threadsSlot={threadsSlot}
        isThreadsLoading={isThreadsLoading}
      />
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
  // Derive memory state from the shared (React Query deduped) hook instead of
  // accepting it as props — see structure-derive-dont-duplicate.
  const { data: memory, isLoading: isMemoryLoading } = useMemory({
    agentId: agentId,
    requestContext: useEntityRequestContext('agent', agentId)[0],
    queryOptions: { enabled: Boolean(agentId) },
  });
  const hasMemory = Boolean(memory?.result);
  const memoryType = memory?.memoryType;

  const { selectedTab, handleTabChange } = useMemorySidebarTab();
  const { isPanelOpen } = useMemoryTimeline();
  const { streamProgress } = useObservationalMemoryContext();
  const { recentMessages, semanticRecallOn, workingMemoryOn, observationalOn } = useMemoryFeatureFlags(agentId);

  const showMemory = selectedTab === 'memory';
  const showMemoryDetail = observationalOn && isPanelOpen;

  // streamProgress is intentionally retained across thread switches (for reload
  // display), so only trust it for the thread this card belongs to — otherwise the
  // collapsed bar keeps the previous thread's percentage.
  const liveProgress = streamProgress?.threadId === threadId ? streamProgress : null;
  // Status parts are streamed but not persisted, so on a fresh load there is no live
  // progress yet. Fall back to the durable OM record the same way the expanded OM
  // section and the timeline panel do, otherwise the bar stays empty after a reload.
  const { data: thread } = useThread({
    threadId: threadId,
    agentId: agentId,
    requestContext: useEntityRequestContext('agent', agentId)[0],
    queryOptions: { enabled: Boolean(threadId) && threadId !== 'new' && Boolean(agentId) },
  });
  const { data: memoryConfigData } = useMemoryConfig({
    agentId: agentId,
    requestContext: useEntityRequestContext('agent', agentId)[0],
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

  // Mutually exclusive views, each an early return of bare content.
  if (isMemoryLoading) {
    return <MemorySidebarSkeleton />;
  }

  if (showMemoryDetail) {
    return (
      <div data-testid="memory-sidebar-panel" className="h-full min-h-0 min-w-0">
        <MemoryDetailView agentId={agentId} threadId={threadId} />
      </div>
    );
  }

  return (
    <MemorySidebarView
      hasMemory={hasMemory}
      showMemory={showMemory}
      recentMessages={recentMessages}
      semanticRecallOn={semanticRecallOn}
      workingMemoryOn={workingMemoryOn}
      observationalOn={observationalOn}
      observationPercent={observationPercent}
      onTabChange={handleTabChange}
      threadsSlot={
        threadsSlot ||
        (hasMemory ? (
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
        ) : (
          <EmptyState
            titleSlot="Memory not enabled"
            descriptionSlot="Conversations are only saved as threads when the agent has memory configured."
            actionSlot={
              <Button
                icon={<IconSquareArrowTopRight />}
                render={<a href="https://mastra.ai/docs/memory/overview" target="_blank" rel="noopener noreferrer" />}
              >
                View documentation
              </Button>
            }
          />
        ))
      }
      memorySlot={<AgentMemory agentId={agentId} threadId={threadId} memoryType={memoryType} />}
      footerSlot={<AgentCapabilitiesFooter agentId={agentId} />}
    />
  );
}

function MemorySidebarSkeleton() {
  return (
    <div data-testid="memory-sidebar-skeleton" className="flex h-full min-h-0 w-full flex-col gap-2.5 p-3">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}
