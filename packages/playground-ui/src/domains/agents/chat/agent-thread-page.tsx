import type { ReactNode } from 'react';
import { AgentChat } from './agent-chat';
import type { AgentChatProps } from './agent-chat';
import { AgentChatLoadingSkeleton, AgentLandingLoadingSkeleton } from './agent-loading-skeletons';
import { AgentPanelLayout } from './agent-panel-layout';
import type { AgentPanelLayoutProps } from './agent-panel-layout';
import { AgentThreadContent } from './agent-thread-content';
import { ChatThreads } from './chat-threads';
import type { ChatThreadsProps } from './chat-threads';
import { ThreadInputProvider } from './drafts/ThreadInputContext';
import { AgentThreadSidebar } from './memory-sidebar/agent-thread-sidebar';
import type { AgentThreadSidebarExtensions } from './memory-sidebar/agent-thread-sidebar';
import { SidebarPanel } from './sidebar-panel';
import type { useAgentThreadPage } from './use-agent-thread-page';
import { useThreadsPanel } from './use-threads-panel';
import { Button } from '@/ds/components/Button';
import { Txt } from '@/ds/components/Txt';

export type AgentThreadPageState = ReturnType<typeof useAgentThreadPage>;
export type AgentThreadListFeatures = Pick<
  ChatThreadsProps,
  'canDeleteThread' | 'canRenameThread' | 'onHidePanel' | 'onCollapseEmpty' | 'renderRenameDialog'
>;
export type AgentThreadLayoutBehavior = Pick<
  AgentPanelLayoutProps,
  'isMemoryTimelineOpen' | 'registerThreadsPanel' | 'browserOverlay'
>;

export interface AgentThreadPageProps {
  agentId: string;
  state: AgentThreadPageState;
  canPersistDraft: boolean;
  isLoading?: boolean;
  chat: Omit<AgentChatProps, 'agentId' | 'threadId' | 'isNewThread' | 'memory' | 'refreshThreadList'>;
  threadListFeatures?: AgentThreadListFeatures;
  layoutBehavior?: AgentThreadLayoutBehavior;
  sidebarExtensions?: AgentThreadSidebarExtensions;
  renderSidebar?: (threadList: ReactNode) => ReactNode;
}

export function AgentThreadPage({
  agentId,
  state,
  canPersistDraft,
  isLoading = false,
  chat,
  threadListFeatures,
  layoutBehavior,
  sidebarExtensions,
  renderSidebar,
}: AgentThreadPageProps) {
  const threadsPanel = useThreadsPanel();
  const { actualThreadId, isNewThread, hasMemory, isMemoryLoading, threads, isThreadsLoading } = state;
  const hideThreadsPanel =
    isNewThread && !hasMemory && (isLoading ? !isMemoryLoading : isThreadsLoading || threads.length === 0);
  const threadList = state.threadsError ? (
    <div role="alert">
      <Txt>Could not load conversations.</Txt>
      <Button onClick={() => void state.refreshThreads()}>Retry</Button>
    </div>
  ) : (
    <ChatThreads
      onHidePanel={threadsPanel?.collapse}
      onCollapseEmpty={threadsPanel?.collapseOnce}
      {...threadListFeatures}
      threads={isLoading ? [] : threads}
      threadId={actualThreadId}
      resourceId={agentId}
      resourceType="agent"
      embedded
      isLoading={isLoading || isThreadsLoading}
      onDelete={state.deleteThread}
    />
  );
  const sidebar = hideThreadsPanel ? undefined : renderSidebar ? (
    renderSidebar(threadList)
  ) : (
    <SidebarPanel>
      <AgentThreadSidebar {...sidebarExtensions} agentId={agentId} threadList={threadList} isLoading={isLoading} />
    </SidebarPanel>
  );
  const body = isLoading ? (
    isNewThread ? (
      <AgentLandingLoadingSkeleton />
    ) : (
      <div className="relative grid h-full overflow-y-auto pt-4" data-testid="agent-thread-skeleton" aria-busy="true">
        <AgentChatLoadingSkeleton />
      </div>
    )
  ) : (
    <AgentThreadContent threadId={actualThreadId}>
      <AgentChat
        {...chat}
        agentId={agentId}
        threadId={actualThreadId}
        memory={hasMemory}
        isNewThread={isNewThread}
        refreshThreadList={state.refreshThreadList}
      />
    </AgentThreadContent>
  );

  return (
    <ThreadInputProvider
      ref={state.draftHandle}
      key={`${canPersistDraft}:${JSON.stringify([...state.draftScope, actualThreadId])}`}
      persistence={canPersistDraft ? { key: state.draftKey, threadId: actualThreadId } : undefined}
    >
      <AgentPanelLayout
        registerThreadsPanel={threadsPanel?.registerPanel}
        {...layoutBehavior}
        agentId={agentId}
        leftSlot={sidebar}
        leftDrawerLabel="Threads"
      >
        {body}
      </AgentPanelLayout>
    </ThreadInputProvider>
  );
}
