import { useParams } from 'react-router';

import { Sidebar } from '../Sidebar';
import { ChatLayout } from '../layouts/ChatLayout';
import { useThreadWorkspacePath } from '../domains/workspace-viewer/hooks/useThreadWorkspacePath';
import { WorkspaceFilesProvider } from '../domains/workspace-viewer/context/WorkspaceFilesProvider';
import { WorkspaceFilesSurface } from '../domains/workspace-viewer/components/WorkspaceFilesSurface';
import { workspaceFilesInsetClass } from '../domains/workspace-viewer/layout';
import { useInvalidateWorkspaceChangesOnRunCompletion } from '../domains/workspace-viewer/useInvalidateWorkspaceChangesOnRunCompletion';
import { ChatHeader } from '../domains/chat/components/ChatHeader';
import { FactorySessionHeader } from '../domains/factory/components/RelatedFactorySessions';
import { ChatMessageList } from '../domains/chat/components/ChatMessageList';
import { ComposerPanel } from '../domains/chat/components/ComposerPanel';
import { TaskPanel } from '../domains/chat/components/TaskPanel';
import { ChatMessageBoundary, ChatSessionBoundary } from '../domains/chat/context/ChatSessionProvider';
import { useChatTranscript } from '../domains/chat/context/useChatTranscript';
import { useGlobalShortcuts } from '../domains/chat/hooks/useGlobalShortcuts';
import { useRouteThreadSync } from '../../hooks/useRouteThreadSync';
import { useThreadPageKickoffs } from '../domains/chat/hooks/useThreadPageKickoffs';
import { useFactoryQuery } from '../../hooks/useFactories';
import { Spinner } from '@mastra/playground-ui/components/Spinner';

const threadComposerContainerClass = 'w-full p-3 md:p-5';
const threadComposerInnerClass = 'mx-auto w-full max-w-[var(--chat-column,80ch)]';

export function ThreadPage() {
  const { factoryId, threadId } = useParams<{ factoryId: string; threadId?: string }>();
  const factoryQuery = useFactoryQuery(factoryId);
  const workspace = useThreadWorkspacePath();

  const resolvingSession = factoryQuery.isPending || workspace.isPending;

  return (
    <ChatLayout
      sidebar={<Sidebar />}
      main={
        resolvingSession ? (
          // bare bar stands in — the session header needs WorkspaceFilesProvider
          <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
            <ChatHeader />
            <div className="grid min-h-0 place-items-center">
              <Spinner aria-label="Loading session" className="text-icon3" />
            </div>
          </div>
        ) : (
          <ChatSessionBoundary threadId={threadId}>
            <WorkspaceFilesProvider>
              <ThreadPageMain workspacePath={workspace.workspacePath} />
            </WorkspaceFilesProvider>
          </ChatSessionBoundary>
        )
      }
    />
  );
}

function ThreadPageMain({ workspacePath }: { workspacePath: string | undefined }) {
  const { busy } = useChatTranscript();
  useInvalidateWorkspaceChangesOnRunCompletion(workspacePath, busy);
  useGlobalShortcuts();

  return (
    // explicit col — implicit auto col sizes to max-content, long breadcrumb widens the column
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)_auto_auto] overflow-hidden">
      <FactorySessionHeader />
      {/* Flex, not block — ChatMessageBoundary's loading state sizes itself with flex-1. */}
      <div className="relative flex min-h-0 flex-col overflow-hidden">
        <ChatMessageBoundary>
          <ThreadPageContent />
        </ChatMessageBoundary>
        <WorkspaceFilesSurface />
      </div>
      <TaskPanel />
      <ThreadComposer />
    </div>
  );
}

function ThreadComposer() {
  return (
    <div className={threadComposerContainerClass}>
      <div className={workspaceFilesInsetClass}>
        <div className={threadComposerInnerClass} role="region" aria-label="Thread composer">
          <ComposerPanel />
        </div>
      </div>
    </div>
  );
}

function ThreadPageContent() {
  useRouteThreadSync();
  useThreadPageKickoffs();

  return <ChatMessageList />;
}
