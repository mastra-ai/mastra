import { ChatShell } from '@mastra/playground-ui/components/ChatShell';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';
import { useRef } from 'react';
import { useParams } from 'react-router';

import { useFactoryQuery } from '../../hooks/useFactories';
import { useRouteThreadSync } from '../../hooks/useRouteThreadSync';
import { Sidebar } from '../Sidebar';
import { ChatHeader } from '../domains/chat/components/ChatHeader';
import { EmptyThreadState } from '../domains/chat/components/EmptyThreadState';
import { GoalPanel } from '../domains/chat/components/GoalPanel';
import { PageTitle } from '../domains/chat/components/PageTitle';
import { SessionChatSurface } from '../domains/chat/components/SessionChatSurface';
import { SessionFavicon } from '../domains/chat/components/SessionFavicon';
import { ThreadRailLayer } from '../domains/chat/components/ThreadRailLayer';
import { ChatSessionBoundary } from '../domains/chat/context/ChatSessionProvider';
import { useChatTranscript } from '../domains/chat/context/useChatTranscript';
import { useGlobalShortcuts } from '../domains/chat/hooks/useGlobalShortcuts';
import { useHandoffPrompt } from '../domains/chat/hooks/useHandoffPrompt';
import { FactorySessionHeader } from '../domains/factory/components/RelatedFactorySessions';
import { WorkspaceFilesProvider } from '../domains/workspace-viewer/context/WorkspaceFilesProvider';
import { WorkspaceFilesSurface } from '../domains/workspace-viewer/components/WorkspaceFilesSurface';
import { useThreadWorkspacePath } from '../domains/workspace-viewer/hooks/useThreadWorkspacePath';
import { useWiderThan } from '../domains/workspace-viewer/hooks/useWiderThan';
import { chatColumnClass, RAIL_MIN_REM } from '../domains/workspace-viewer/layout';
import { useInvalidateWorkspaceChangesOnRunCompletion } from '../domains/workspace-viewer/useInvalidateWorkspaceChangesOnRunCompletion';
import { ChatLayout } from '../layouts/ChatLayout';

import '../domains/chat/components/chat-enter.css';

const threadShellClass = cn(
  chatColumnClass,
  '[--chat-inset-end:var(--workspace-files-inset,0px)] [--chat-gutter:0.25rem]',
);

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
          <ResolvingSessionMain />
        ) : (
          <ChatSessionBoundary threadId={threadId}>
            <PageTitle />
            <WorkspaceFilesProvider>
              <ThreadPageMain workspacePath={workspace.workspacePath} threadId={workspace.threadId} />
            </WorkspaceFilesProvider>
          </ChatSessionBoundary>
        )
      }
    />
  );
}

function ResolvingSessionMain() {
  return (
    <>
      <SessionFavicon state="initializing" />
      <ChatShell className="flex-1">
        <ChatShell.Bar>
          <ChatHeader />
        </ChatShell.Bar>
        <div className="grid min-h-0 flex-1 place-items-center">
          <Spinner aria-label="Loading session" className="text-icon3" />
        </div>
      </ChatShell>
    </>
  );
}

function ThreadPageMain({
  workspacePath,
  threadId,
}: {
  workspacePath: string | undefined;
  threadId: string | undefined;
}) {
  useGlobalShortcuts();
  useRouteThreadSync();
  useHandoffPrompt();
  const railBoxRef = useRef<HTMLDivElement>(null);
  const { wider: railFits } = useWiderThan(railBoxRef, RAIL_MIN_REM);

  return (
    <ThreadSessionEffects workspacePath={workspacePath} threadId={threadId}>
      <SessionChatSurface
        header={<FactorySessionHeader />}
        secondaryBar={<GoalPanel />}
        emptyState={<EmptyThreadState />}
        composerLabel="Thread composer"
        className={threadShellClass}
        contentRef={railBoxRef}
        contentOverlay={railFits ? <ThreadRailLayer /> : undefined}
        stageSurface={<WorkspaceFilesSurface />}
      />
    </ThreadSessionEffects>
  );
}

function ThreadSessionEffects({
  workspacePath,
  threadId,
  children,
}: {
  workspacePath: string | undefined;
  threadId: string | undefined;
  children: ReactNode;
}) {
  const { busy } = useChatTranscript();
  useInvalidateWorkspaceChangesOnRunCompletion(workspacePath, threadId, busy);
  return children;
}
