import { useIsMobile } from '@mastra/playground-ui/hooks/use-is-mobile';
import { useEffect, useState } from 'react';
import { useMatch, useParams } from 'react-router';

import { useRouteThreadSync } from '../../../shared/hooks/useRouteThreadSync';
import { Sidebar } from '../Sidebar';
import { ChatHeader } from '../domains/chat/components/ChatHeader';
import { ChatMessageList } from '../domains/chat/components/ChatMessageList';
import { ComposerPanel } from '../domains/chat/components/ComposerPanel';
import { TaskPanel } from '../domains/chat/components/TaskPanel';
import { ChatMessageBoundary, ChatSessionBoundary } from '../domains/chat/context/ChatSessionProvider';
import { useChatSessionContext } from '../domains/chat/context/useChatSessionContext';
import { useGlobalShortcuts } from '../domains/chat/hooks/useGlobalShortcuts';
import { useThreadPageKickoffs } from '../domains/chat/hooks/useThreadPageKickoffs';
import {
  FactorySessionContextPanel,
  type FactorySessionContextTab,
} from '../domains/factory/components/FactorySessionContextPanel';
import { FactorySessionHeader } from '../domains/factory/components/RelatedFactorySessions';
import { renderedPaths } from '../domains/workspace-viewer/config';
import { WorkspaceViewerPanel } from '../domains/workspace-viewer/components/WorkspaceViewerPanel';
import { useActiveFactoryContext } from '../domains/workspaces/context/ActiveFactoryProvider';
import { activeWorkspacePath, findUserSessionByThreadId } from '../domains/workspaces/services/factories';
import { ChatLayout } from '../ui/ChatLayout';
import { Spinner } from '@mastra/playground-ui/components/Spinner';

const threadComposerContainerClass = 'w-full p-3 md:p-5';
const threadComposerInnerClass = 'mx-auto w-full max-w-[80ch]';

export function ThreadPage() {
  const { activeFactory, factoriesPending } = useActiveFactoryContext();
  const { kind, resourceId, factorySessionState, sessionEnabled } = useChatSessionContext();
  const { threadId } = useParams();
  const userThreadMatch = useMatch('/factories/:factoryId/user/threads/:threadId');
  const isMobile = useIsMobile();
  const [workspaceViewerExpanded, setWorkspaceViewerExpanded] = useState(false);
  const [workspaceViewerVisible, setWorkspaceViewerVisible] = useState(true);
  const userSessionMatch = threadId ? findUserSessionByThreadId(threadId) : undefined;
  const activeUserSessionMatch =
    userSessionMatch && activeFactory?.id === userSessionMatch.factory.id ? userSessionMatch : undefined;
  const isUserThreadRoute = Boolean(userThreadMatch);
  const workspaceFactory = isUserThreadRoute ? activeUserSessionMatch?.factory : activeFactory;
  const workspacePath = workspaceFactory
    ? activeWorkspacePath(workspaceFactory, activeUserSessionMatch?.worktree)
    : undefined;
  const factoryProjectId = factorySessionState?.factoryProjectId;
  const factoryEligible = Boolean(
    kind === 'factory' && sessionEnabled && threadId && resourceId && factoryProjectId && workspacePath,
  );
  const factoryPanelAvailable = factoryEligible && !isMobile;
  const currentLifecycleKey =
    factoryPanelAvailable && threadId && factoryProjectId
      ? `${factoryProjectId}:${threadId}:${resourceId}:${resourceId}`
      : undefined;
  const [factoryPanelState, setFactoryPanelState] = useState<{
    lifecycleKey: string | undefined;
    tab: FactorySessionContextTab;
  }>(() => ({ lifecycleKey: currentLifecycleKey, tab: 'task' }));
  const lifecycleKeysMatch = Boolean(currentLifecycleKey && factoryPanelState.lifecycleKey === currentLifecycleKey);
  const activeFactoryTab = lifecycleKeysMatch ? factoryPanelState.tab : 'task';

  useEffect(() => {
    if (factoryPanelState.lifecycleKey === currentLifecycleKey) return;
    setFactoryPanelState({ lifecycleKey: currentLifecycleKey, tab: 'task' });
    setWorkspaceViewerExpanded(false);
  }, [currentLifecycleKey, factoryPanelState.lifecycleKey]);

  if (factoriesPending) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const collapseRightPanel = () => {
    setWorkspaceViewerExpanded(false);
    setFactoryPanelState({ lifecycleKey: currentLifecycleKey, tab: 'task' });
    setWorkspaceViewerVisible(false);
  };

  const openRightPanel = () => {
    setWorkspaceViewerExpanded(false);
    setFactoryPanelState({ lifecycleKey: currentLifecycleKey, tab: 'task' });
    setWorkspaceViewerVisible(true);
  };

  const changeFactoryTab = (tab: FactorySessionContextTab) => {
    setWorkspaceViewerExpanded(false);
    setFactoryPanelState({ lifecycleKey: currentLifecycleKey, tab });
  };

  const rightPanelExpanded = factoryPanelAvailable
    ? lifecycleKeysMatch && activeFactoryTab === 'files' && workspaceViewerExpanded
    : factoryPanelState.lifecycleKey
      ? false
      : workspaceViewerExpanded;
  const rightPanelVisible = workspaceViewerVisible || isMobile;

  const rightPanel = factoryPanelAvailable ? (
    currentLifecycleKey && workspacePath && factoryProjectId && threadId && rightPanelVisible ? (
      <FactorySessionContextPanel
        factoryProjectId={factoryProjectId}
        threadId={threadId}
        resourceId={resourceId}
        sessionId={resourceId}
        workspacePath={workspacePath}
        activeTab={activeFactoryTab}
        onTabChange={changeFactoryTab}
        expanded={rightPanelExpanded}
        onExpandedChange={setWorkspaceViewerExpanded}
        onCollapse={collapseRightPanel}
      />
    ) : undefined
  ) : workspacePath && rightPanelVisible ? (
    <WorkspaceViewerPanel
      workspacePath={workspacePath}
      renderedPaths={renderedPaths}
      title="Workspace files"
      context={workspaceFactory?.name}
      onExpandedChange={setWorkspaceViewerExpanded}
    />
  ) : undefined;

  return (
    <ChatLayout
      sidebar={<Sidebar />}
      header={<ChatHeader />}
      rightPanelExpanded={rightPanelExpanded}
      rightPanelAvailable={factoryPanelAvailable || Boolean(workspacePath)}
      rightPanelOpenLabel={factoryPanelAvailable ? 'Open task and workspace context' : undefined}
      onRightPanelOpen={openRightPanel}
      onRightPanelClose={factoryPanelAvailable ? undefined : () => setWorkspaceViewerVisible(false)}
      rightPanel={rightPanel}
      main={
        <ChatSessionBoundary threadId={threadId}>
          <ThreadPageMain />
        </ChatSessionBoundary>
      }
    />
  );
}

function ThreadPageMain() {
  useGlobalShortcuts();

  return (
    <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto_auto] overflow-hidden">
      <ChatMessageBoundary>
        <ThreadPageContent />
      </ChatMessageBoundary>
      <TaskPanel />
      <ThreadComposer />
    </div>
  );
}

function ThreadComposer() {
  return (
    <div className={threadComposerContainerClass}>
      <div className={threadComposerInnerClass} role="region" aria-label="Thread composer">
        <ComposerPanel />
      </div>
    </div>
  );
}

function ThreadPageContent() {
  useRouteThreadSync();
  useThreadPageKickoffs();

  return (
    <div className="flex min-h-0 flex-col">
      <FactorySessionHeader />
      <div className="min-h-0 flex-1 overflow-hidden">
        <ChatMessageList />
      </div>
    </div>
  );
}
