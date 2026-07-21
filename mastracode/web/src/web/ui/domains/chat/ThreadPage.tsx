import { useState } from 'react';
import { useLocation, useParams } from 'react-router';

import { useOverlays } from '../../lib/overlays';
import { Sidebar } from '../../Sidebar';
import { ChatLayout } from '../../ui/ChatLayout';
import { renderedPaths } from '../workspace-viewer/config';
import { WorkspaceViewerPanel } from '../workspace-viewer/components/WorkspaceViewerPanel';
import { EmptyFactoryState } from '../workspaces/components/EmptyFactoryState';
import { useActiveFactoryContext } from '../workspaces/context/ActiveFactoryProvider';
import { activeWorkspacePath, findUserSessionByThreadId } from '../workspaces/services/factories';
import { ChatHeader } from './components/ChatHeader';
import { FactorySessionHeader } from '../factory/components/RelatedFactorySessions';
import { ChatMessageList } from './components/ChatMessageList';
import { ComposerPanel } from './components/ComposerPanel';
import { TaskPanel } from './components/TaskPanel';
import { ChatMessageBoundary, ChatSessionBoundary } from './context/ChatSessionProvider';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { useRouteThreadSync } from '../../../../shared/hooks/useRouteThreadSync';
import { useThreadPageKickoffs } from './hooks/useThreadPageKickoffs';

const threadComposerContainerClass = 'w-full p-3 md:p-5';
const threadComposerInnerClass = 'mx-auto w-full max-w-[80ch]';

export function ThreadPage() {
  const overlays = useOverlays();
  const { activeFactory } = useActiveFactoryContext();
  const { threadId } = useParams();
  const location = useLocation();
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

  if (!activeFactory) {
    return <EmptyFactoryState onOpenFactories={() => overlays.open('factories')} />;
  }

  return (
    <ChatLayout
      sidebar={<Sidebar />}
      header={<ChatHeader />}
      rightPanelExpanded={workspaceViewerExpanded}
      rightPanelAvailable={Boolean(workspacePath)}
      onRightPanelOpen={() => setWorkspaceViewerVisible(true)}
      rightPanel={
        workspacePath && workspaceViewerVisible ? (
          <WorkspaceViewerPanel
            workspacePath={workspacePath}
            renderedPaths={renderedPaths}
            title="Workspace files"
            context={workspaceFactory?.name}
            onExpandedChange={setWorkspaceViewerExpanded}
            onCollapse={() => setWorkspaceViewerVisible(false)}
          />
        ) : undefined
      }
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
