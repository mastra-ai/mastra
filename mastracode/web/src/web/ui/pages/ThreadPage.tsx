import { useIsMobile } from '@mastra/playground-ui/hooks/use-is-mobile';
import { useState } from 'react';
import { useMatch, useParams } from 'react-router';

import { Sidebar } from '../Sidebar';
import { ChatLayout } from '../layouts/ChatLayout';
import { renderedPaths } from '../domains/workspace-viewer/config';
import { WorkspaceViewerPanel } from '../domains/workspace-viewer/components/WorkspaceViewerPanel';
import { ChatHeader } from '../domains/chat/components/ChatHeader';
import { FactorySessionHeader } from '../domains/factory/components/RelatedFactorySessions';
import { ChatMessageList } from '../domains/chat/components/ChatMessageList';
import { ComposerPanel } from '../domains/chat/components/ComposerPanel';
import { TaskPanel } from '../domains/chat/components/TaskPanel';
import { ChatMessageBoundary, ChatSessionBoundary } from '../domains/chat/context/ChatSessionProvider';
import { useGlobalShortcuts } from '../domains/chat/hooks/useGlobalShortcuts';
import { useRouteThreadSync } from '../../../shared/hooks/useRouteThreadSync';
import { useThreadPageKickoffs } from '../domains/chat/hooks/useThreadPageKickoffs';
import { useFactoryQuery } from '../../../shared/hooks/useFactories';
import { useUserSessionQuery } from '../../../shared/hooks/useWorkspaces';
import { useWorkspaceRenderedListing } from '../../../shared/hooks/use-fs';
import { Spinner } from '@mastra/playground-ui/components/Spinner';

const threadComposerContainerClass = 'w-full p-3 md:p-5';
const threadComposerInnerClass = 'mx-auto w-full max-w-[80ch]';

export function ThreadPage() {
  const { factoryId, sessionId, threadId } = useParams<{ factoryId: string; sessionId?: string; threadId?: string }>();
  const userThreadMatch = useMatch('/factories/:factoryId/user/threads/:threadId');
  const isMobile = useIsMobile();
  const [workspaceViewerExpanded, setWorkspaceViewerExpanded] = useState(false);
  const [workspaceViewerVisible, setWorkspaceViewerVisible] = useState(true);
  const isUserThreadRoute = Boolean(userThreadMatch);
  const routeSessionId = isUserThreadRoute ? threadId : sessionId;
  const factoryQuery = useFactoryQuery(factoryId);
  const userSessionQuery = useUserSessionQuery(routeSessionId);
  const workspaceFactory = factoryQuery.data;
  const workspacePath = userSessionQuery.data?.sandboxWorkdir ?? undefined;
  const artifactsListing = useWorkspaceRenderedListing(workspacePath, renderedPaths[0]?.root);
  const hasWorkspaceFiles = (artifactsListing.data?.entries.length ?? 0) > 0;

  if (factoryQuery.isPending || (Boolean(routeSessionId) && userSessionQuery.isPending)) {
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
      rightPanelAvailable={Boolean(workspacePath && hasWorkspaceFiles)}
      onRightPanelOpen={() => setWorkspaceViewerVisible(true)}
      onRightPanelClose={() => setWorkspaceViewerVisible(false)}
      rightPanel={
        workspacePath && hasWorkspaceFiles && (workspaceViewerVisible || isMobile) ? (
          <WorkspaceViewerPanel
            workspacePath={workspacePath}
            renderedPaths={renderedPaths}
            title="Workspace files"
            context={workspaceFactory?.name}
            onExpandedChange={setWorkspaceViewerExpanded}
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
    <div className="grid h-full min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto_auto] overflow-hidden">
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
    <div className="flex min-h-0 min-w-0 flex-col">
      <FactorySessionHeader />
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <ChatMessageList />
      </div>
    </div>
  );
}
