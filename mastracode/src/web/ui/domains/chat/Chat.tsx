import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';

import { OverlaysProvider, useOverlays } from '../../lib/overlays';
import { Sidebar } from '../../Sidebar';
import { ChatLayout } from '../../ui';
import { ActiveProjectProvider, EmptyProjectState, useActiveProjectContext } from '../workspaces';
import { ChatHeader } from './components/ChatHeader';
import { ChatMessageList } from './components/ChatMessageList';
import { ChatOverlays } from './components/ChatOverlays';
import { ComposerPanel } from './components/ComposerPanel';
import { ChatCommandsProvider } from './context/ChatCommandsProvider';
import { ChatSessionProvider, useChatSession } from './context/ChatSessionProvider';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';

/**
 * Composition root for the chat app. All state lives in the providers:
 * project selection (workspaces), the agent-controller session + derived run
 * state (chat), overlay visibility (lib/overlays — platform plumbing), and
 * palette/composer command hand-off (chat). `ChatPage` is the only place
 * that assembles the `ChatLayout` slots — every slot component consumes the
 * matching hooks instead of drilled props.
 */
export default function Chat() {
  return (
    <ActiveProjectProvider>
      <ChatSessionProvider>
        <OverlaysProvider>
          <ChatCommandsProvider>
            <ChatPage />
          </ChatCommandsProvider>
        </OverlaysProvider>
      </ChatSessionProvider>
    </ActiveProjectProvider>
  );
}

function ChatPage() {
  const overlays = useOverlays();
  const { activeProject } = useActiveProjectContext();
  const session = useChatSession();
  const navigate = useNavigate();
  const location = useLocation();
  const { threadId: routeThreadId } = useParams<{ threadId: string }>();
  const locationRouteErrorNotice = (location.state as { routeErrorNotice?: string } | null)?.routeErrorNotice ?? null;
  const [routeErrorNotice, setRouteErrorNotice] = useState<string | null>(null);

  useGlobalShortcuts();

  useEffect(() => {
    if (!routeThreadId) return;
    setRouteErrorNotice(null);
    if (session.status !== 'ready' || session.transcript.threadId === routeThreadId) return;

    void session.switchThread(routeThreadId).catch(err => {
      const message = `Failed to switch thread: ${err instanceof Error ? err.message : String(err)}`;
      setRouteErrorNotice(message);
      void navigate('/new', { replace: true, state: { routeErrorNotice: message } });
      session.pushNotice(message, 'error');
    });
  }, [routeThreadId, session, navigate]);

  return (
    <>
      <ChatLayout
        sidebar={<Sidebar />}
        header={<ChatHeader />}
        sidebarOpen={overlays.isOpen('sidebar')}
        onSidebarClose={() => overlays.close('sidebar')}
        content={
          activeProject ? (
            <ChatMessageList routeErrorNotice={locationRouteErrorNotice ?? routeErrorNotice} />
          ) : (
            <EmptyProjectState onOpenProjects={() => overlays.open('projects')} />
          )
        }
        footer={activeProject ? <ComposerPanel /> : null}
      />

      <ChatOverlays />
    </>
  );
}
