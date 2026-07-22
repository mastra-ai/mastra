import { MainSidebarProvider } from '@mastra/playground-ui/components/MainSidebar';
import type { ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router';

import { OverlaysProvider } from '../../lib/overlays';
import { ChatOverlays } from './components/ChatOverlays';
import { ChatSessionConfigProvider } from './context/ChatSessionProvider';
import { ChatPermissionsProvider } from './context/ChatPermissionsProvider';

/**
 * Shared chat app providers. Route leaves render their own pages so `/new` is a
 * real page boundary instead of a branch inside the thread transcript.
 */
export default function Chat() {
  return (
    <MainSidebarProvider storageKey="mastracode-web" collapsedWidth={0} mobileBreakpoint={768}>
      <ChatSessionRouteProvider>
        <OverlaysProvider>
          <ChatShell />
        </OverlaysProvider>
      </ChatSessionRouteProvider>
    </MainSidebarProvider>
  );
}

function ChatSessionRouteProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const userScoped = pathname.startsWith('/user/threads/');
  const threadId = userScoped
    ? decodeURIComponent(pathname.slice('/user/threads/'.length))
    : pathname.startsWith('/threads/')
      ? decodeURIComponent(pathname.slice('/threads/'.length))
      : undefined;

  return (
    <ChatSessionConfigProvider threadId={threadId} userScoped={userScoped}>
      <ChatPermissionsProvider>{children}</ChatPermissionsProvider>
    </ChatSessionConfigProvider>
  );
}

function ChatShell() {
  return (
    <>
      <Outlet />
      <ChatOverlays />
    </>
  );
}
