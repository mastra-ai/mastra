import type { ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router';

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
      <ChatSessionRouteProvider>
        <OverlaysProvider>
          <ChatCommandsProvider>
            <ChatShell />
          </ChatCommandsProvider>
        </OverlaysProvider>
      </ChatSessionRouteProvider>
    </ActiveProjectProvider>
  );
}

function ChatSessionRouteProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const threadId = pathname.startsWith('/threads/')
    ? decodeURIComponent(pathname.slice('/threads/'.length))
    : undefined;

  return <ChatSessionProvider threadId={threadId}>{children}</ChatSessionProvider>;
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
