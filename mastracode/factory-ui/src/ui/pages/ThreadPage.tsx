import { ChatShell } from '@mastra/playground-ui/components/ChatShell';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import type { ReactNode } from 'react';
import { useRef } from 'react';
import { useParams } from 'react-router';

import { Sidebar } from '../Sidebar';
import { ChatLayout } from '../layouts/ChatLayout';
import { useThreadWorkspacePath } from '../domains/workspace-viewer/hooks/useThreadWorkspacePath';
import { WorkspaceFilesProvider } from '../domains/workspace-viewer/context/WorkspaceFilesProvider';
import { WorkspaceFilesSurface } from '../domains/workspace-viewer/components/WorkspaceFilesSurface';
import { chatColumnClass, RAIL_MIN_REM } from '../domains/workspace-viewer/layout';
import { useWiderThan } from '../domains/workspace-viewer/hooks/useWiderThan';
import { useInvalidateWorkspaceChangesOnRunCompletion } from '../domains/workspace-viewer/useInvalidateWorkspaceChangesOnRunCompletion';
import { ChatHeader } from '../domains/chat/components/ChatHeader';
import { FactorySessionHeader } from '../domains/factory/components/RelatedFactorySessions';
import { ComposerPanel } from '../domains/chat/components/ComposerPanel';
import { ActivityLine } from '../domains/chat/components/ActivityLine';
import { EmptyThreadState } from '../domains/chat/components/EmptyThreadState';
import { GoalPanel } from '../domains/chat/components/GoalPanel';
import { TaskPanel } from '../domains/chat/components/TaskPanel';
import { PageTitle } from '../domains/chat/components/PageTitle';
import { SessionFavicon } from '../domains/chat/components/SessionFavicon';
import { SessionPreparationOverlay } from '../domains/chat/components/SessionPreparationOverlay';
import { Transcript } from '../domains/chat/components/Transcript';
import { TranscriptHistoryLoader } from '../domains/chat/components/TranscriptHistoryLoader';
import { ThreadRailLayer } from '../domains/chat/components/ThreadRailLayer';
import { ChatMessageBoundary, ChatSessionBoundary } from '../domains/chat/context/ChatSessionProvider';
import { useChatMessagePreparation } from '../domains/chat/context/useChatMessagePreparation';
import { useChatTranscript } from '../domains/chat/context/useChatTranscript';
import { useGlobalShortcuts } from '../domains/chat/hooks/useGlobalShortcuts';
import { useHandoffPrompt } from '../domains/chat/hooks/useHandoffPrompt';
import { useRouteThreadSync } from '../../hooks/useRouteThreadSync';
import { useFactoryQuery } from '../../hooks/useFactories';

import '../domains/chat/components/chat-enter.css';

// The docked workspace card claims room on the end edge; the shell pads its own
// scroller by it, so the column stays centred on what is left.
const threadShellClass = `chat-surface-enter flex-1 ${chatColumnClass} [--chat-inset-end:var(--workspace-files-inset,0px)] md:[--chat-gutter:1.25rem]`;

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

// Owns the favicon for this branch: the session boundary is not mounted yet, so
// nothing else can write it. A bare bar stands in — the session header needs
// WorkspaceFilesProvider.
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
    <ThreadShell workspacePath={workspacePath} threadId={threadId}>
      <ChatShell.Bar>
        <FactorySessionHeader />
      </ChatShell.Bar>
      <ChatShell.Bar>
        <GoalPanel />
      </ChatShell.Bar>
      <ChatShell.Stage>
        <ChatShell.Viewport>
          <ThreadPreparationOverlay />
          <div ref={railBoxRef} className="relative flex min-h-full min-w-0 flex-1 flex-col">
            {railFits && <ThreadRailLayer />}
            <ChatShell.Content className="gap-0 pt-6">
              <ChatShell.Column className="flex-1">
                <ChatMessageBoundary showPreparation={false}>
                  <ThreadTranscript />
                </ChatMessageBoundary>
              </ChatShell.Column>
            </ChatShell.Content>
            <ChatShell.Dock>
              <ChatShell.ScrollButton aria-label="Jump to latest message" />
              <ChatShell.Column className="gap-2">
                <TaskPanel />
                <div role="region" aria-label="Thread composer">
                  <ComposerPanel />
                </div>
              </ChatShell.Column>
            </ChatShell.Dock>
          </div>
        </ChatShell.Viewport>
        <WorkspaceFilesSurface />
      </ChatShell.Stage>
    </ThreadShell>
  );
}

// Reads the transcript so its caller does not: the context republishes on every
// streamed chunk, and children passed through keep their element identity.
function ThreadShell({
  workspacePath,
  threadId,
  children,
}: {
  workspacePath: string | undefined;
  threadId: string | undefined;
  children: ReactNode;
}) {
  const { busy, loadMore } = useChatTranscript();
  useInvalidateWorkspaceChangesOnRunCompletion(workspacePath, threadId, busy);
  const canLoadMore = loadMore.hasMore && !loadMore.isLoading;

  return (
    <ChatShell
      className={threadShellClass}
      scroller={{
        autoScroll: true,
        defaultScrollPosition: 'last-anchor',
        preserveScrollOnPrepend: true,
        onReachStart: canLoadMore ? loadMore.load : undefined,
      }}
    >
      {children}
    </ChatShell>
  );
}

function ThreadPreparationOverlay() {
  const { historyInitializing, preparing } = useChatMessagePreparation();
  return <SessionPreparationOverlay historyInitializing={historyInitializing} preparing={preparing} />;
}

function ThreadTranscript() {
  const { transcript } = useChatTranscript();
  return (
    <>
      <TranscriptHistoryLoader />
      {transcript.entries.length === 0 && <EmptyThreadState />}
      <Transcript tail={<ActivityLine />} />
    </>
  );
}
