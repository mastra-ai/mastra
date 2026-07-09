import { Outlet } from 'react-router';

import { OverlaysProvider } from '../../lib/overlays';
import { ActiveProjectProvider } from '../workspaces';
import { ChatOverlays } from './components/ChatOverlays';
import { ChatCommandsProvider } from './context/ChatCommandsProvider';
import { ChatSessionProvider } from './context/ChatSessionProvider';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';

/**
 * Shared chat app providers. Route leaves render their own pages so `/new` is a
 * real page boundary instead of a branch inside the thread transcript.
 */
export default function Chat() {
  return (
    <ActiveProjectProvider>
      <ChatSessionProvider>
        <OverlaysProvider>
          <ChatCommandsProvider>
            <ChatShell />
          </ChatCommandsProvider>
        </OverlaysProvider>
      </ChatSessionProvider>
    </ActiveProjectProvider>
  );
}

function ChatShell() {
  useGlobalShortcuts();

  return (
    <>
      <Outlet />
      <ChatOverlays />
    </>
  );
}
