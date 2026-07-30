import { ChatShell } from '@mastra/playground-ui/components/ChatShell';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import type { ReactNode } from 'react';
import { useParams } from 'react-router';

import { Sidebar } from '../Sidebar';
import { ChatLayout } from '../layouts/ChatLayout';
import { useThreadWorkspacePath } from '../domains/workspace-viewer/hooks/useThreadWorkspacePath';
import { WorkspaceFilesProvider } from '../domains/workspace-viewer/context/WorkspaceFilesProvider';
import { WorkspaceFilesSurface } from '../domains/workspace-viewer/components/WorkspaceFilesSurface';
import { chatColumnClass } from '../domains/workspace-viewer/layout';
import { useInvalidateWorkspaceChangesOnRunCompletion } from '../domains/workspace-viewer/useInvalidateWorkspaceChangesOnRunCompletion';
import { ChatHeader } from '../domains/chat/components/ChatHeader';
import { FactorySessionHeader } from '../domains/factory/components/RelatedFactorySessions';
import { ComposerPanel } from '../domains/chat/components/ComposerPanel';
import { ConnectionNotice } from '../domains/chat/components/ConnectionNotice';
import { EmptyThreadState } from '../domains/chat/components/EmptyThreadState';
import { GoalPanel } from '../domains/chat/components/GoalPanel';
import { TaskPanel } from '../domains/chat/components/TaskPanel';
import { Transcript } from '../domains/chat/components/Transcript';
import { TranscriptHistoryLoader } from '../domains/chat/components/TranscriptHistoryLoader';
import { WorkingIndicator } from '../domains/chat/components/WorkingIndicator';
import { ChatMessageBoundary, ChatSessionBoundary } from '../domains/chat/context/ChatSessionProvider';
import { useChatTranscript } from '../domains/chat/context/useChatTranscript';
import { useGlobalShortcuts } from '../domains/chat/hooks/useGlobalShortcuts';
import { useRouteThreadSync } from '../../hooks/useRouteThreadSync';
import { useThreadPageKickoffs } from '../domains/chat/hooks/useThreadPageKickoffs';
import { useFactoryQuery } from '../../hooks/useFactories';

// The docked workspace card claims room on the end edge; the shell pads its own
// scroller by it, so the column stays centred on what is left.
const threadShellClass = `flex-1 ${chatColumnClass} [--chat-inset-end:var(--workspace-files-inset,0px)] md:[--chat-gutter:1.25rem]`;

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
          <ChatShell className="flex-1">
            <ChatShell.Bar>
              <ChatHeader />
            </ChatShell.Bar>
            <div className="grid min-h-0 flex-1 place-items-center">
              <Spinner aria-label="Loading session" className="text-icon3" />
            </div>
          </ChatShell>
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
  useGlobalShortcuts();
  useRouteThreadSync();
  useThreadPageKickoffs();

  return (
    <ThreadShell workspacePath={workspacePath}>
      <ChatShell.Bar>
        <FactorySessionHeader />
      </ChatShell.Bar>
      <ChatShell.Bar>
        <GoalPanel />
      </ChatShell.Bar>
      <ChatShell.Stage>
        <ChatShell.Viewport>
          <ChatShell.Content className="gap-0 pt-6">
            <ChatShell.Column className="flex-1">
              <ConnectionNotice />
              <ChatMessageBoundary>
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
        </ChatShell.Viewport>
        <WorkspaceFilesSurface />
      </ChatShell.Stage>
    </ThreadShell>
  );
}

// Reads the transcript so its caller does not: the context republishes on every
// streamed chunk, and children passed through keep their element identity.
function ThreadShell({ workspacePath, children }: { workspacePath: string | undefined; children: ReactNode }) {
  const { busy, loadMore } = useChatTranscript();
  useInvalidateWorkspaceChangesOnRunCompletion(workspacePath, busy);
  const canLoadMore = loadMore.hasMore && !loadMore.isLoading;

  return (
    <ChatShell
      className={threadShellClass}
      scroller={{
        autoScroll: true,
        preserveScrollOnPrepend: true,
        onReachStart: canLoadMore ? loadMore.load : undefined,
      }}
    >
      {children}
    </ChatShell>
  );
}

function ThreadTranscript() {
  const { transcript, showWorkingIndicator } = useChatTranscript();

  return (
    <>
      <TranscriptHistoryLoader />
      {transcript.entries.length === 0 && <EmptyThreadState />}
      <Transcript />
      {showWorkingIndicator && <WorkingIndicator />}
    </>
  );
}
