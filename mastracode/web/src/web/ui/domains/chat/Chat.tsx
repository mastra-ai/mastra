import { MainSidebarProvider } from '@mastra/playground-ui/components/MainSidebar';
import type { ReactNode } from 'react';
import { Outlet, useMatch } from 'react-router';

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
  // `useParams` in a layout can't see descendant params, so match the thread
  // routes explicitly (params come back already decoded).
  const userThreadMatch = useMatch('/factories/:factoryId/user/threads/:threadId');
  const factoryThreadMatch = useMatch('/factories/:factoryId/workspaces/:sessionId/threads/:threadId');
  // The supervisor page provides its own session context bound to the
  // deterministic supervisor resource; disable the generic provider so it
  // cannot claim that resource before the supervisor session is established.
  const supervisorMatch = useMatch('/factories/:factoryId/supervisor');
  const userScoped = userThreadMatch !== null;
  const threadId = userThreadMatch?.params.threadId ?? factoryThreadMatch?.params.threadId;

  return (
    <ChatSessionConfigProvider threadId={threadId} userScoped={userScoped} disabled={supervisorMatch !== null}>
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
