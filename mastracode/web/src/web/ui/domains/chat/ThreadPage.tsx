import { useState } from 'react';
import { useLocation, useParams } from 'react-router';

import { Sidebar } from '../../Sidebar';
import { ChatLayout } from '../../ui/ChatLayout';
import { renderedPaths } from '../workspace-viewer/config';
import { WorkspaceViewerPanel } from '../workspace-viewer/components/WorkspaceViewerPanel';
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
import { Spinner } from '@mastra/playground-ui/components/Spinner';

const threadComposerContainerClass = 'w-full p-3 md:p-5';
const threadComposerInnerClass = 'mx-auto w-full max-w-[80ch]';

export function ThreadPage() {
  const { activeFactory, factoriesPending } = useActiveFactoryContext();
  const { threadId } = useParams();
  const location = useLocation();
  const [workspaceViewerExpanded, setWorkspaceViewerExpanded] = useState(false);
  const [workspaceViewerVisible, setWorkspaceViewerVisible] = useState(true);
  const userSessionMatch = threadId ? findUserSessionByThreadId(threadId) : undefined;
  const activeUserSessionMatch =
    userSessionMatch && activeFactory?.id === userSessionMatch.factory.id ? userSessionMatch : undefined;
  const isUserThreadRoute = location.pathname.includes('/user/threads/');
  const workspaceFactory = isUserThreadRoute ? activeUserSessionMatch?.factory : activeFactory;
  const workspacePath = workspaceFactory
    ? activeWorkspacePath(workspaceFactory, activeUserSessionMatch?.worktree)
    : undefined;

  if (factoriesPending) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Spinner />
      </div>
    );
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
