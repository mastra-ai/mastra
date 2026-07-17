import { useEffect, useRef } from 'react';
import { useParams } from 'react-router';

import { useOverlays } from '../../lib/overlays';
import { Sidebar } from '../../Sidebar';
import { ChatLayout } from '../../ui';
import { EmptyProjectState, useActiveProjectContext } from '../workspaces';
import { ChatHeader } from './components/ChatHeader';
import { ChatMessageList } from './components/ChatMessageList';
import { ChatOverlays } from './components/ChatOverlays';
import { ComposerPanel } from './components/ComposerPanel';
import { ChatMessageBoundary, ChatSessionBoundary } from './context/ChatSessionProvider';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { useRouteThreadSync } from '../../../../shared/hooks/useRouteThreadSync';
import { useSendAgentControllerMessageMutation } from '../../../../shared/hooks/useAgentControllerRunMutations';
import { useChatConnection } from './context/useChatConnection';
import { useChatSessionContext } from './context/useChatSessionContext';
import { useChatTranscript } from './context/useChatTranscript';
import { AGENT_CONTROLLER_ID } from './services/constants';
import { claimThreadPageKickoffs } from './services/threadPageReadiness';

const threadComposerContainerClass = 'w-full px-3 md:px-5';
const threadComposerInnerClass = 'mx-auto w-full max-w-[80ch]';

export function ThreadPage() {
  const overlays = useOverlays();
  const { activeProject } = useActiveProjectContext();
  const { threadId } = useParams();

  return (
    <ChatLayout
      sidebar={<Sidebar />}
      header={<ChatHeader />}
      sidebarOpen={overlays.isOpen('sidebar')}
      onSidebarClose={() => overlays.close('sidebar')}
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
  const { status, threadId: activeThreadId } = useChatConnection();
  const { resourceId, projectPath, baseUrl, sessionEnabled } = useChatSessionContext();
  const { localUser, clearPending, pushNotice } = useChatTranscript();
  const { threadId: routeThreadId } = useParams();
  const sendMessage = useSendAgentControllerMessageMutation({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    projectPath,
    baseUrl,
    enabled: sessionEnabled,
  });
  const pendingKickoffs = useRef(0);

  useEffect(() => {
    if (status !== 'ready' || !routeThreadId || activeThreadId !== routeThreadId) return;
    const kickoffs = claimThreadPageKickoffs({ resourceId, projectPath, threadId: routeThreadId });
    for (const kickoff of kickoffs) {
      localUser(kickoff.message);
      pendingKickoffs.current += 1;
      const dispatch = sendMessage.mutateAsync(kickoff.message);
      kickoff.accept();
      void dispatch.then(
        () => {
          pendingKickoffs.current -= 1;
        },
        error => {
          pendingKickoffs.current -= 1;
          if (pendingKickoffs.current === 0) clearPending();
          const message = error instanceof Error ? error.message : 'Factory kickoff dispatch failed';
          pushNotice(message, 'error');
        },
      );
    }
  }, [
    activeThreadId,
    clearPending,
    localUser,
    projectPath,
    pushNotice,
    resourceId,
    routeThreadId,
    sendMessage,
    status,
  ]);

  return <ChatMessageList />;
}
