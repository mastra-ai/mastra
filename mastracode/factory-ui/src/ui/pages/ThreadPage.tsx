import { Button, buttonVariants } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { cn } from '@mastra/playground-ui/utils/cn';
import { MessageSquareOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { useRef } from 'react';
import { Link, useParams } from 'react-router';

import { useFactoryQuery } from '../../hooks/useFactories';
import { useRouteThreadSync } from '../../hooks/useRouteThreadSync';
import { ChatPageLayout } from '../domains/chat/components/ChatPageLayout';
import { EmptyThreadState } from '../domains/chat/components/EmptyThreadState';
import { GoalPanel } from '../domains/chat/components/GoalPanel';
import { PageTitle } from '../domains/chat/components/PageTitle';
import { SessionChatSurface } from '../domains/chat/components/SessionChatSurface';
import { SessionFavicon } from '../domains/chat/components/SessionFavicon';
import { ThreadRailLayer } from '../domains/chat/components/ThreadRailLayer';
import { TeammateSessionLine } from '../domains/chat/components/TeammateSessionLine';
import { ChatSessionBoundary } from '../domains/chat/context/ChatSessionProvider';
import { useChatTranscript } from '../domains/chat/context/useChatTranscript';
import { useGlobalShortcuts } from '../domains/chat/hooks/useGlobalShortcuts';
import { useHandoffPrompt } from '../domains/chat/hooks/useHandoffPrompt';
import { FactorySessionPage } from '../domains/factory/components/RelatedFactorySessions';
import { WorkspaceFilesProvider } from '../domains/workspace-viewer/context/WorkspaceFilesProvider';
import { WorkspaceFilesSurface } from '../domains/workspace-viewer/components/WorkspaceFilesSurface';
import { useThreadWorkspacePath } from '../domains/workspace-viewer/hooks/useThreadWorkspacePath';
import { useWiderThan } from '../domains/workspace-viewer/hooks/useWiderThan';
import { chatColumnClass, RAIL_MIN_REM } from '../domains/workspace-viewer/layout';
import { useInvalidateWorkspaceChangesOnRunCompletion } from '../domains/workspace-viewer/useInvalidateWorkspaceChangesOnRunCompletion';

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
    <>
      {workspace.error ? (
        <SessionUnavailableMain error={workspace.error} factoryId={factoryId} onRetry={workspace.retry} />
      ) : resolvingSession ? (
        <ResolvingSessionMain />
      ) : (
        <ChatSessionBoundary threadId={threadId}>
          <PageTitle />
          <WorkspaceFilesProvider>
            <ThreadPageMain workspacePath={workspace.workspacePath} threadId={workspace.threadId} />
          </WorkspaceFilesProvider>
        </ChatSessionBoundary>
      )}
    </>
  );
}

function ResolvingSessionMain() {
  return (
    <ChatPageLayout>
      <SessionFavicon state="initializing" />
      <div className="grid min-h-0 place-items-center">
        <Spinner aria-label="Loading session" className="text-muted-foreground" />
      </div>
    </ChatPageLayout>
  );
}

function SessionUnavailableMain({
  error,
  factoryId,
  onRetry,
}: {
  error: Error;
  factoryId: string | undefined;
  onRetry: () => void;
}) {
  // The server answers a missing session and a teammate's private one with the same 404.
  const notFound = (error as { status?: number }).status === 404;
  return (
    <ChatPageLayout>
      <div className="grid min-h-0 place-items-center">
        <EmptyState
          as="h1"
          iconSlot={<MessageSquareOff />}
          titleSlot={notFound ? 'Session not found' : 'Could not load this session'}
          descriptionSlot={
            notFound
              ? 'This session does not exist, or it is private to another user.'
              : `Failed to load the session: ${error.message}`
          }
          actionSlot={
            notFound ? (
              factoryId && (
                <Link to={`/factories/${factoryId}/new`} className={buttonVariants({ variant: 'primary' })}>
                  Start a new session
                </Link>
              )
            ) : (
              <Button variant="primary" onClick={onRetry}>
                Retry
              </Button>
            )
          }
        />
      </div>
    </ChatPageLayout>
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
      <FactorySessionPage>
        <SessionChatSurface
          secondaryBar={<GoalPanel />}
          emptyState={<EmptyThreadState />}
          composerLabel="Thread composer"
          composerFooter={<TeammateSessionLine />}
          className={threadShellClass}
          contentRef={railBoxRef}
          contentOverlay={railFits ? <ThreadRailLayer /> : undefined}
          stageSurface={<WorkspaceFilesSurface />}
        />
      </FactorySessionPage>
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
