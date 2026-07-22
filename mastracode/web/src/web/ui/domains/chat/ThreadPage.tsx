import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router';

import { Sidebar } from '../../Sidebar';
import { ChatLayout } from '../../ui/ChatLayout';
import {
  FactorySessionContextPanel,
  type FactorySessionContextTab,
} from '../factory/components/FactorySessionContextPanel';
import { FactorySessionHeader } from '../factory/components/RelatedFactorySessions';
import { renderedPaths } from '../workspace-viewer/config';
import { WorkspaceViewerPanel } from '../workspace-viewer/components/WorkspaceViewerPanel';
import { EmptyFactoryState } from '../workspaces/components/EmptyFactoryState';
import { useActiveFactoryContext } from '../workspaces/context/ActiveFactoryProvider';
import { activeWorkspacePath, findUserSessionByThreadId } from '../workspaces/services/factories';
import { ChatHeader } from './components/ChatHeader';
import { ChatMessageList } from './components/ChatMessageList';
import { ComposerPanel } from './components/ComposerPanel';
import { TaskPanel } from './components/TaskPanel';
import { ChatMessageBoundary, ChatSessionBoundary } from './context/ChatSessionProvider';
import { useChatSessionContext } from './context/useChatSessionContext';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { useRouteThreadSync } from '../../../../shared/hooks/useRouteThreadSync';
import { useThreadPageKickoffs } from './hooks/useThreadPageKickoffs';
import { Spinner } from '@mastra/playground-ui/components/Spinner';

const threadComposerContainerClass = 'w-full p-3 md:p-5';
const threadComposerInnerClass = 'mx-auto w-full max-w-[80ch]';
const DESKTOP_RIGHT_PANEL_QUERY = '(min-width: 64rem)';

function useDesktopRightPanelAvailable() {
  const [available, setAvailable] = useState(() => window.matchMedia(DESKTOP_RIGHT_PANEL_QUERY).matches);

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_RIGHT_PANEL_QUERY);
    const onChange = (event: MediaQueryListEvent) => setAvailable(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return available;
}

export function ThreadPage() {
  const { activeFactory, factoriesPending } = useActiveFactoryContext();
  const { kind, threadBasePath, resourceId, projectPath, factorySessionState, sessionEnabled } =
    useChatSessionContext();
  const { threadId } = useParams();
  const location = useLocation();
  const desktopRightPanelAvailable = useDesktopRightPanelAvailable();
  const [workspaceViewerExpanded, setWorkspaceViewerExpanded] = useState(false);
  const [workspaceViewerVisible, setWorkspaceViewerVisible] = useState(true);
  const userSessionMatch = threadId ? findUserSessionByThreadId(threadId) : undefined;
  const activeUserSessionMatch =
    userSessionMatch && activeFactory?.id === userSessionMatch.factory.id ? userSessionMatch : undefined;
  const isUserThreadRoute = location.pathname.startsWith('/user/threads/');
  const workspaceFactory = isUserThreadRoute ? activeUserSessionMatch?.factory : activeFactory;
  const workspacePath = workspaceFactory
    ? activeWorkspacePath(workspaceFactory, activeUserSessionMatch?.worktree)
    : undefined;
  const factoryProjectId = factorySessionState?.factoryProjectId;
  const bindingSessionId = sessionEnabled && projectPath === undefined ? resourceId : undefined;
  const factoryEligible =
    kind === 'factory' &&
    threadBasePath === '/threads' &&
    Boolean(
      threadId &&
      resourceId &&
      bindingSessionId &&
      factoryProjectId &&
      factorySessionState?.projectRepositoryId &&
      workspacePath,
    );
  const currentLifecycleKey =
    factoryEligible && desktopRightPanelAvailable && threadId && factoryProjectId && bindingSessionId
      ? `${factoryProjectId}:${threadId}:${resourceId}:${bindingSessionId}`
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

  if (!activeFactory) {
    return <EmptyFactoryState />;
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

  const rightPanelExpanded = factoryEligible
    ? lifecycleKeysMatch && activeFactoryTab === 'files' && workspaceViewerExpanded
    : factoryPanelState.lifecycleKey
      ? false
      : workspaceViewerExpanded;

  const rightPanel = factoryEligible ? (
    currentLifecycleKey && workspacePath && bindingSessionId && factoryProjectId && threadId && workspaceViewerVisible ? (
      <FactorySessionContextPanel
        factoryProjectId={factoryProjectId}
        threadId={threadId}
        resourceId={resourceId}
        sessionId={bindingSessionId}
        workspacePath={workspacePath}
        activeTab={activeFactoryTab}
        onTabChange={changeFactoryTab}
        expanded={rightPanelExpanded}
        onExpandedChange={setWorkspaceViewerExpanded}
        onCollapse={collapseRightPanel}
      />
    ) : undefined
  ) : workspacePath && workspaceViewerVisible ? (
    <WorkspaceViewerPanel
      workspacePath={workspacePath}
      renderedPaths={renderedPaths}
      title="Workspace files"
      context={workspaceFactory?.name}
      onExpandedChange={setWorkspaceViewerExpanded}
      onCollapse={collapseRightPanel}
    />
  ) : undefined;

  return (
    <ChatLayout
      sidebar={<Sidebar />}
      header={<ChatHeader />}
      rightPanelExpanded={rightPanelExpanded}
      rightPanelAvailable={Boolean(workspacePath)}
      rightPanelOpenLabel={factoryEligible ? 'Context' : undefined}
      rightPanelOpenAriaLabel={factoryEligible ? 'Open task and workspace context' : undefined}
      onRightPanelOpen={openRightPanel}
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
