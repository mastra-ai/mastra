import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';
import { useRef } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';

import { useRouteThreadSync } from '../../hooks/useRouteThreadSync';
import { ChatPageLayout } from '../domains/chat/components/ChatPageLayout';
import { EmptyThreadState } from '../domains/chat/components/EmptyThreadState';
import { GoalPanel } from '../domains/chat/components/GoalPanel';
import { PageTitle } from '../domains/chat/components/PageTitle';
import { SessionChatSurface } from '../domains/chat/components/SessionChatSurface';
import { ThreadRailLayer } from '../domains/chat/components/ThreadRailLayer';
import { TeammateSessionLine } from '../domains/chat/components/TeammateSessionLine';
import { ChatSessionBoundary } from '../domains/chat/context/ChatSessionProvider';
import { useChatTranscript } from '../domains/chat/context/useChatTranscript';
import { useGlobalShortcuts } from '../domains/chat/hooks/useGlobalShortcuts';
import { DraftSessionCreateError, isSessionNotFound } from '../domains/workspaces/services/user-sessions';
import { useHandoffPrompt } from '../domains/chat/hooks/useHandoffPrompt';
import { failedDraftState } from '../domains/chat/services/handoffFiles';
import { FactorySessionPage } from '../domains/factory/components/RelatedFactorySessions';
import { SessionPanelOverview } from '../domains/factory/components/SessionPanelOverview';
import { SessionPanelSubject } from '../domains/factory/components/SessionPanelSubject';
import type { WorkspacePanelPage } from '../domains/workspace-viewer/context/WorkspacePanelContext';
import { WorkspaceFilesProvider } from '../domains/workspace-viewer/context/WorkspaceFilesProvider';
import { useThreadWorkspacePath } from '../domains/workspace-viewer/hooks/useThreadWorkspacePath';
import { useWiderThan } from '../domains/workspace-viewer/hooks/useWiderThan';
import { chatColumnClass, RAIL_MIN_REM } from '../domains/workspace-viewer/layout';
import { useInvalidateWorkspaceChangesOnRunCompletion } from '../domains/workspace-viewer/useInvalidateWorkspaceChangesOnRunCompletion';
import { useRefreshWorkspaceFilesOnToolCalls } from '../domains/workspace-viewer/useRefreshWorkspaceFilesOnToolCalls';
import { newUserSessionPath } from '../domains/workspaces/services/factoryPaths';

import '../domains/chat/components/chat-enter.css';
import { IconChatBubble7Off } from '@mastra/playground-ui/icons/central/IconChatBubble7Off';

const threadShellClass = cn(chatColumnClass, '[--chat-gutter:0.25rem]');

const SESSION_PANEL: WorkspacePanelPage = {
  subject: lead => <SessionPanelSubject lead={lead} />,
  overview: workspace => <SessionPanelOverview workspace={workspace} />,
};

export function ThreadPage() {
  const { factoryId, threadId } = useParams<{ factoryId: string; threadId?: string }>();
  const workspace = useThreadWorkspacePath();

  if (workspace.error instanceof DraftSessionCreateError) {
    return (
      <Navigate
        replace
        to={workspace.error.draftPath}
        state={failedDraftState(workspace.error.draft, workspace.error.message)}
      />
    );
  }

  if (workspace.error && isSessionNotFound(workspace.error)) return <SessionNotFoundMain factoryId={factoryId} />;

  return (
    <ChatSessionBoundary threadId={threadId}>
      <PageTitle />
      <WorkspaceFilesProvider page={SESSION_PANEL}>
        <ThreadPageMain workspacePath={workspace.workspacePath} threadId={workspace.threadId} />
      </WorkspaceFilesProvider>
    </ChatSessionBoundary>
  );
}

function SessionNotFoundMain({ factoryId }: { factoryId: string | undefined }) {
  const navigate = useNavigate();
  return (
    <ChatPageLayout>
      <div className="grid min-h-0 place-items-center">
        <EmptyState
          as="h1"
          iconSlot={<IconChatBubble7Off />}
          titleSlot="Session not found"
          descriptionSlot="This session does not exist, or it is private to another user."
          actionSlot={
            factoryId && (
              <Button variant="primary" onClick={() => void navigate(newUserSessionPath(factoryId))}>
                Start a new session
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
  return (
    <ThreadSessionEffects workspacePath={workspacePath}>
      <FactorySessionPage>
        <SessionChatSurface
          secondaryBar={<GoalPanel />}
          emptyState={<EmptyThreadState />}
          composerLabel="Thread composer"
          composerStatus={<TeammateSessionLine />}
          className={threadShellClass}
          contentOverlay={<ThreadRailSlot />}
        />
      </FactorySessionPage>
    </ThreadSessionEffects>
  );
}

function ThreadRailSlot() {
  const boxRef = useRef<HTMLDivElement>(null);
  const { wider: railFits } = useWiderThan(boxRef, RAIL_MIN_REM);

  return (
    <div ref={boxRef} className="pointer-events-none absolute inset-0">
      {railFits && <ThreadRailLayer />}
    </div>
  );
}

function ThreadSessionEffects({ workspacePath, children }: { workspacePath: string | undefined; children: ReactNode }) {
  useGlobalShortcuts();
  useRouteThreadSync();
  useHandoffPrompt();
  const { busy, transcript } = useChatTranscript();
  useInvalidateWorkspaceChangesOnRunCompletion(workspacePath, busy);
  useRefreshWorkspaceFilesOnToolCalls(workspacePath, transcript.entries);
  return children;
}
