import { useEffect, useEffectEvent } from 'react';
import { useNavigate, useParams } from 'react-router';

import { useApiConfig } from '../../../../shared/api/config';
import { useOverlays } from '../../lib/overlays';
import { Sidebar } from '../../Sidebar';
import { ChatLayout } from '../../ui';
import { EmptyProjectState, useActiveProjectContext } from '../workspaces';
import { deriveProjectPath } from '../workspaces/hooks/useWorkspaces';
import { ChatHeader } from './components/ChatHeader';
import { ChatMessageList } from './components/ChatMessageList';
import { ComposerPanel } from './components/ComposerPanel';
import { useChatSession } from './context/ChatSessionProvider';
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
  const { baseUrl } = useApiConfig();
  const { activeProject, resourceId, sessionEnabled } = useActiveProjectContext();
  const { status, transcript, resetCurrentThread, resetHydration, syncState, pushNotice } = useChatSession();
  const projectPath = deriveProjectPath(activeProject);
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

  const switchToRouteThread = useEffectEvent((threadId: string) => {
    if (!threadsQuery.data?.some(thread => thread.id === threadId)) {
      const message = `Failed to switch thread: thread ${threadId} was not found`;
      resetCurrentThread();
      pushNotice(message, 'error');
      void navigate('/new', { replace: true, state: { routeErrorNotice: message } });
      return;
    }

    resetHydration();
    resetCurrentThread(threadId);
    void switchThreadMutation
      .mutateAsync(threadId)
      .then(state => syncState(state))
      .catch(err => {
        const message = `Failed to switch thread: ${err instanceof Error ? err.message : String(err)}`;
        resetCurrentThread();
        pushNotice(message, 'error');
        void navigate('/new', { replace: true, state: { routeErrorNotice: message } });
      });
  });

  useEffect(() => {
    if (!routeThreadId) return;
    if (status !== 'ready' || !transcript.threadId || transcript.threadId === routeThreadId || !threadsQuery.isSuccess)
      return;
    switchToRouteThread(routeThreadId);
  }, [routeThreadId, status, transcript.threadId, threadsQuery.isSuccess]);

  return <ChatMessageList />;
}
