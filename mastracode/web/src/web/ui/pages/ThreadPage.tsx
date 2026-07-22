import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { useIsMobile } from '@mastra/playground-ui/hooks/use-is-mobile';
import { useState } from 'react';
import { useMatch, useParams } from 'react-router';

import { useFactoryQuery } from '../../../shared/hooks/useFactories';
import { useRouteThreadSync } from '../../../shared/hooks/useRouteThreadSync';
import { useUserSessionQuery } from '../../../shared/hooks/useWorkspaces';
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
import { WorkspaceViewerPanel } from '../domains/workspace-viewer/components/WorkspaceViewerPanel';
import { renderedPaths } from '../domains/workspace-viewer/config';
import { ChatLayout } from '../ui/ChatLayout';

const threadComposerContainerClass = 'w-full p-3 md:p-5';
const threadComposerInnerClass = 'mx-auto w-full max-w-[80ch]';

interface FactoryTaskPanelAddress {
  factoryProjectId: string;
  threadId: string;
  resourceId: string;
  sessionId: string;
}

export function ThreadPage() {
  const { factoryId, sessionId, threadId } = useParams<{ factoryId: string; sessionId?: string; threadId?: string }>();
  const userThreadMatch = useMatch('/factories/:factoryId/user/threads/:threadId');
  const isMobile = useIsMobile();
  const factoryQuery = useFactoryQuery(factoryId);
  const userSessionQuery = useUserSessionQuery(userThreadMatch ? threadId : undefined);
  const { kind, resourceId, factorySessionState, sessionEnabled } = useChatSessionContext();
  const isUserThreadRoute = Boolean(userThreadMatch);
  const workspacePath = isUserThreadRoute ? userSessionQuery.data?.sessionId : sessionId;
  const factoryProjectId = factorySessionState?.factoryProjectId;
  const factoryTaskAddress =
    !isMobile && kind === 'factory' && sessionEnabled && factoryProjectId && threadId && resourceId && sessionId
      ? { factoryProjectId, threadId, resourceId, sessionId }
      : undefined;

  if (factoryQuery.isPending || (isUserThreadRoute && userSessionQuery.isPending)) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const panelLifecycleKey = factoryTaskAddress
    ? `task:${factoryProjectId}:${threadId}:${resourceId}:${sessionId}`
    : `files:${workspacePath ?? 'none'}:${isMobile ? 'mobile' : 'desktop'}`;

  return (
    <ThreadPageLayout
      key={panelLifecycleKey}
      workspacePath={workspacePath}
      workspaceFactoryName={factoryQuery.data?.name}
      factoryTaskAddress={factoryTaskAddress}
      isMobile={isMobile}
      threadId={threadId}
    />
  );
}

function ThreadPageLayout({
  workspacePath,
  workspaceFactoryName,
  factoryTaskAddress,
  isMobile,
  threadId,
}: {
  workspacePath: string | undefined;
  workspaceFactoryName: string | undefined;
  factoryTaskAddress: FactoryTaskPanelAddress | undefined;
  isMobile: boolean;
  threadId: string | undefined;
}) {
  const [workspaceViewerExpanded, setWorkspaceViewerExpanded] = useState(false);
  const [workspaceViewerVisible, setWorkspaceViewerVisible] = useState(true);
  const [activeFactoryTab, setActiveFactoryTab] = useState<FactorySessionContextTab>('task');

  const collapseRightPanel = () => {
    setWorkspaceViewerExpanded(false);
    setActiveFactoryTab('task');
    setWorkspaceViewerVisible(false);
  };

  const openRightPanel = () => {
    setWorkspaceViewerExpanded(false);
    setActiveFactoryTab('task');
    setWorkspaceViewerVisible(true);
  };

  const changeFactoryTab = (tab: FactorySessionContextTab) => {
    setWorkspaceViewerExpanded(false);
    setActiveFactoryTab(tab);
  };

  const rightPanelExpanded = factoryTaskAddress
    ? activeFactoryTab === 'files' && workspaceViewerExpanded
    : workspaceViewerExpanded;
  const rightPanelVisible = workspaceViewerVisible || isMobile;
  const rightPanel = factoryTaskAddress ? (
    workspacePath && rightPanelVisible ? (
      <FactorySessionContextPanel
        {...factoryTaskAddress}
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
      context={workspaceFactoryName}
      onExpandedChange={setWorkspaceViewerExpanded}
    />
  ) : undefined;

  return (
    <ChatLayout
      sidebar={<Sidebar />}
      header={<ChatHeader />}
      rightPanelExpanded={rightPanelExpanded}
      rightPanelAvailable={Boolean(factoryTaskAddress || workspacePath)}
      rightPanelOpenLabel={factoryTaskAddress ? 'Open task and workspace context' : undefined}
      onRightPanelOpen={openRightPanel}
      onRightPanelClose={factoryTaskAddress ? undefined : () => setWorkspaceViewerVisible(false)}
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
