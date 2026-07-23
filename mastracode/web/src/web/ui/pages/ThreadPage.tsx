import { useIsMobile } from '@mastra/playground-ui/hooks/use-is-mobile';
import { Button } from '@mastra/playground-ui/components/Button';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { PanelRightIcon } from 'lucide-react';
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

const threadComposerContainerClass = 'w-full p-3 md:p-5';
const threadComposerInnerClass = 'mx-auto w-full max-w-[80ch]';

export function ThreadPage() {
  const { factoryId, sessionId, threadId } = useParams<{ factoryId: string; sessionId?: string; threadId?: string }>();
  const isMobile = useIsMobile();
  const userThreadMatch = useMatch('/factories/:factoryId/user/threads/:threadId');
  const [workspaceViewerExpanded, setWorkspaceViewerExpanded] = useState(false);
  const [workspaceViewerOverride, setWorkspaceViewerOverride] = useState<{
    workspacePath: string;
    visible: boolean;
  }>();
  const isUserThreadRoute = Boolean(userThreadMatch);
  const routeSessionId = isUserThreadRoute ? threadId : sessionId;
  const factoryQuery = useFactoryQuery(factoryId);
  const userSessionQuery = useUserSessionQuery(routeSessionId);
  const workspaceFactory = factoryQuery.data;
  const workspacePath = userSessionQuery.data?.sandboxWorkdir ?? undefined;
  const artifactsListing = useWorkspaceRenderedListing(workspacePath, renderedPaths[0]?.root);
  const hasWorkspaceFiles = (artifactsListing.data?.entries.length ?? 0) > 0;
  const workspaceViewerVisible =
    workspaceViewerOverride && workspaceViewerOverride.workspacePath === workspacePath
      ? workspaceViewerOverride.visible
      : hasWorkspaceFiles;
  const setWorkspaceViewerVisible = (visible: boolean) => {
    if (!workspacePath) return;
    setWorkspaceViewerOverride({ workspacePath, visible });
  };
  const workspacePanelToggleLabel = workspaceViewerVisible ? 'Close workspace files' : 'Open workspace files';

  const resolvingSession = factoryQuery.isPending || (isUserThreadRoute && userSessionQuery.isPending);
  return (
    <ChatLayout
      sidebar={<Sidebar />}
      header={<ChatHeader />}
      rightPanelExpanded={workspaceViewerExpanded}
      rightPanelOpen={workspaceViewerVisible}
      rightPanel={
        workspacePath ? (
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
        resolvingSession ? (
          <div className="grid h-full min-h-0 place-items-center">
            <Spinner aria-label="Loading session" className="text-icon3" />
          </div>
        ) : (
          <ChatSessionBoundary threadId={threadId}>
            <ThreadPageMain
              workspacePanelOpen={workspaceViewerVisible}
              workspacePanelAction={
                workspacePath && !isMobile ? (
                  <Button
                    type="button"
                    size="icon-md"
                    variant="ghost"
                    tooltip={workspacePanelToggleLabel}
                    className="hidden rounded-md lg:inline-flex"
                    onClick={() => setWorkspaceViewerVisible(!workspaceViewerVisible)}
                    aria-label={workspacePanelToggleLabel}
                    aria-controls="chat-right-slot"
                    aria-expanded={workspaceViewerVisible}
                  >
                    <PanelRightIcon
                      data-open={workspaceViewerVisible}
                      className="transition-transform duration-220 data-[open=false]:rotate-180 motion-reduce:transition-none"
                    />
                  </Button>
                ) : undefined
              }
            />
          </ChatSessionBoundary>
        )
      }
    />
  );
}

function ThreadPageMain({
  workspacePanelOpen,
  workspacePanelAction,
}: {
  workspacePanelOpen: boolean;
  workspacePanelAction?: ReactNode;
}) {
  useGlobalShortcuts();

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <FactorySessionHeader actions={workspacePanelAction} />
      <div
        data-panel-open={workspacePanelOpen}
        className="grid min-h-0 min-w-0 flex-1 grid-rows-[minmax(0,1fr)_auto_auto] overflow-hidden transition-[padding-right] duration-220 ease-[cubic-bezier(0.32,0.72,0,1)] lg:data-[panel-open=true]:pr-[calc(var(--chat-right-panel-width)+0.5rem)] motion-reduce:transition-none in-data-[panel-gesture=active]:transition-none"
      >
        <ChatMessageBoundary>
          <ThreadPageContent />
        </ChatMessageBoundary>
        <TaskPanel />
        <ThreadComposer />
      </div>
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
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <ChatMessageList />
      </div>
    </div>
  );
}
