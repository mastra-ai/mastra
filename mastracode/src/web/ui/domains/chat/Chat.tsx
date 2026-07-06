import { OverlaysProvider, useOverlays } from '../../lib/overlays';
import { Sidebar } from '../../Sidebar';
import { ChatLayout } from '../../ui';
import { ActiveProjectProvider, EmptyProjectState, useActiveProjectContext } from '../workspaces';
import { ChatHeader } from './components/ChatHeader';
import { ChatMessageList } from './components/ChatMessageList';
import { ChatOverlays } from './components/ChatOverlays';
import { ComposerPanel } from './components/ComposerPanel';
import { ChatCommandsProvider } from './context/ChatCommandsProvider';
import { ChatSessionProvider } from './context/ChatSessionProvider';
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

  useGlobalShortcuts();

  return (
    <>
      <ChatLayout
        sidebar={<Sidebar />}
        header={<ChatHeader />}
        sidebarOpen={overlays.isOpen('sidebar')}
        onSidebarClose={() => overlays.close('sidebar')}
        content={
          activeProject ? <ChatMessageList /> : <EmptyProjectState onOpenProjects={() => overlays.open('projects')} />
        }
        footer={activeProject ? <ComposerPanel /> : null}
      />

      <ChatOverlays />
    </>
  );
}
