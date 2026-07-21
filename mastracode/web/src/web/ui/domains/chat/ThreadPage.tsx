import { useState } from 'react';
import { useLocation, useParams } from 'react-router';

import { useOverlays } from '../../lib/overlays';
import { useProjectRoute } from '../../lib/useProjectRoute';
import { ChatLayout } from '../../ui';
import { renderedPaths, WorkspaceViewerPanel } from '../workspace-viewer';
import {
  activeWorkspacePath,
  EmptyFactoryState,
  findUserSessionByThreadId,
  useActiveFactoryContext,
} from '../workspaces';
import { ChatMessageList } from './components/ChatMessageList';
import { ChatOverlays } from './components/ChatOverlays';
import { ComposerPanel } from './components/ComposerPanel';
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
  const projectRoute = useProjectRoute();
  const [workspaceViewerExpanded, setWorkspaceViewerExpanded] = useState(false);
  const [workspaceViewerVisible, setWorkspaceViewerVisible] = useState(true);
  const userSessionMatch = threadId ? findUserSessionByThreadId(threadId) : undefined;
  const activeUserSessionMatch =
    userSessionMatch && activeFactory?.id === userSessionMatch.factory.id ? userSessionMatch : undefined;
  const isUserThreadRoute = location.pathname.startsWith(projectRoute.path('user/threads/'));
  const workspaceFactory = isUserThreadRoute ? activeUserSessionMatch?.factory : activeFactory;
  const workspacePath = workspaceFactory
    ? activeWorkspacePath(workspaceFactory, activeUserSessionMatch?.worktree)
    : undefined;

  return (
    <ChatLayout
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
          {activeFactory ? (
            <ThreadPageMain />
          ) : (
            <EmptyFactoryState onOpenFactories={() => overlays.open('factories')} />
          )}
          <ChatOverlays />
        </ChatSessionBoundary>
      }
    />
  );
}

function ThreadPageMain() {
  useGlobalShortcuts();

  return (
    <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden">
      <ChatMessageBoundary>
        <ThreadPageContent />
      </ChatMessageBoundary>
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

  return <ChatMessageList />;
}
