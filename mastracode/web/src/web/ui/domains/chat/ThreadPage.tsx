import { useState } from 'react';
import { useParams } from 'react-router';

import { useOverlays } from '../../lib/overlays';
import { Sidebar } from '../../Sidebar';
import { ChatLayout } from '../../ui';
import { renderedPaths, WorkspaceViewerPanel } from '../workspace-viewer';
import {
  activeWorkspacePath,
  EmptyProjectState,
  findUserSessionByThreadId,
  useActiveProjectContext,
} from '../workspaces';
import { ChatHeader } from './components/ChatHeader';
import { ChatMessageList } from './components/ChatMessageList';
import { ChatOverlays } from './components/ChatOverlays';
import { ComposerPanel } from './components/ComposerPanel';
import { ChatMessageBoundary, ChatSessionBoundary } from './context/ChatSessionProvider';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { useRouteThreadSync } from '../../../../shared/hooks/useRouteThreadSync';
import { useThreadPageKickoffs } from './hooks/useThreadPageKickoffs';

const threadComposerContainerClass = 'w-full px-3 md:px-5';
const threadComposerInnerClass = 'mx-auto w-full max-w-[80ch]';

export function ThreadPage() {
  const overlays = useOverlays();
  const { activeProject } = useActiveProjectContext();
  const { threadId } = useParams();
  const [workspaceViewerExpanded, setWorkspaceViewerExpanded] = useState(false);
  const [workspaceViewerVisible, setWorkspaceViewerVisible] = useState(true);
  const userSessionMatch = threadId ? findUserSessionByThreadId(threadId) : undefined;
  const workspaceProject = userSessionMatch?.project ?? activeProject;
  const workspacePath = workspaceProject
    ? activeWorkspacePath(workspaceProject, userSessionMatch?.worktree)
    : undefined;

  return (
    <ChatLayout
      sidebar={<Sidebar />}
      header={<ChatHeader />}
      sidebarOpen={overlays.isOpen('sidebar')}
      onSidebarClose={() => overlays.close('sidebar')}
      rightPanelExpanded={workspaceViewerExpanded}
      rightPanelAvailable={Boolean(workspacePath)}
      onRightPanelOpen={() => setWorkspaceViewerVisible(true)}
      rightPanel={
        workspacePath && workspaceViewerVisible ? (
          <WorkspaceViewerPanel
            workspacePath={workspacePath}
            renderedPaths={renderedPaths}
            title="Workspace files"
            context={workspaceProject?.name}
            onExpandedChange={setWorkspaceViewerExpanded}
            onCollapse={() => setWorkspaceViewerVisible(false)}
          />
        ) : undefined
      }
      main={
        <ChatSessionBoundary threadId={threadId}>
          {activeProject ? <ThreadPageMain /> : <EmptyProjectState onOpenProjects={() => overlays.open('projects')} />}
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
