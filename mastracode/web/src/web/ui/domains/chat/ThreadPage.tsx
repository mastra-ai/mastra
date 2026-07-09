import { useEffect, useEffectEvent, useRef } from 'react';
import { useNavigate, useParams } from 'react-router';

import { useOverlays } from '../../lib/overlays';
import { Sidebar } from '../../Sidebar';
import { ChatLayout } from '../../ui';
import { EmptyProjectState, useActiveProjectContext } from '../workspaces';
import { ChatHeader } from './components/ChatHeader';
import { ChatMessageList } from './components/ChatMessageList';
import { ComposerPanel } from './components/ComposerPanel';
import { useChatConnection } from './context/useChatConnection';
import { useChatTranscript } from './context/useChatTranscript';
import { useChatSessionContext } from './context/useChatSessionContext';
import { useSwitchAgentControllerThreadMutation } from './hooks/useAgentControllerThreadMutations';
import { useAgentControllerThreads } from './hooks/useAgentControllerThreads';
import { AGENT_CONTROLLER_ID } from './services/constants';

const threadComposerContainerClass = 'w-full px-3 md:px-5';
const threadComposerInnerClass = 'mx-auto w-full max-w-[80ch]';

export function ThreadPage() {
  const overlays = useOverlays();
  const { activeProject } = useActiveProjectContext();

  return (
    <ChatLayout
      sidebar={<Sidebar />}
      header={<ChatHeader />}
      sidebarOpen={overlays.isOpen('sidebar')}
      onSidebarClose={() => overlays.close('sidebar')}
      content={
        activeProject ? <ThreadPageContent /> : <EmptyProjectState onOpenProjects={() => overlays.open('projects')} />
      }
      footer={activeProject ? <ThreadComposer /> : null}
    />
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
  const { resourceId, sessionEnabled, projectPath, baseUrl } = useChatSessionContext();
  const { status } = useChatConnection();
  const { transcript, reset, syncState, pushNotice } = useChatTranscript();
  const threadsQuery = useAgentControllerThreads({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    projectPath,
    baseUrl,
    enabled: sessionEnabled,
  });
  const switchThreadMutation = useSwitchAgentControllerThreadMutation({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    projectPath,
    baseUrl,
    enabled: sessionEnabled,
  });
  const navigate = useNavigate();
  const { threadId: routeThreadId } = useParams<{ threadId: string }>();
  const latestRouteThreadId = useRef<string | null>(null);

  const switchToRouteThread = useEffectEvent((threadId: string) => {
    latestRouteThreadId.current = threadId;
    const isLatestRequest = () => latestRouteThreadId.current === threadId;

    if (!threadsQuery.data?.some(thread => thread.id === threadId)) {
      const message = `Failed to switch thread: thread ${threadId} was not found`;
      reset();
      pushNotice(message, 'error');
      void navigate('/new', { replace: true, state: { routeErrorNotice: message } });
      return;
    }

    reset(threadId);
    void switchThreadMutation
      .mutateAsync(threadId)
      .then(state => {
        if (!isLatestRequest()) return;
        syncState(state);
      })
      .catch(err => {
        if (!isLatestRequest()) return;
        const message = `Failed to switch thread: ${err instanceof Error ? err.message : String(err)}`;
        reset();
        pushNotice(message, 'error');
        void navigate('/new', { replace: true, state: { routeErrorNotice: message } });
      });
  });

  useEffect(() => {
    latestRouteThreadId.current = routeThreadId ?? null;
    if (!routeThreadId) return;
    if (status !== 'ready' || !threadsQuery.isSuccess) return;
    if (!threadsQuery.data?.some(thread => thread.id === routeThreadId)) {
      switchToRouteThread(routeThreadId);
      return;
    }
    if (transcript.threadId === routeThreadId) return;
    switchToRouteThread(routeThreadId);
  }, [routeThreadId, status, transcript.threadId, threadsQuery.isSuccess, threadsQuery.data]);

  return <ChatMessageList />;
}
