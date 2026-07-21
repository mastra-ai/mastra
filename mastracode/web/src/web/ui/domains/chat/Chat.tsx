import { MainSidebarProvider } from '@mastra/playground-ui/components/MainSidebar';
import type { ReactNode } from 'react';
import { Outlet, useLocation, useParams } from 'react-router';

import { OverlaysProvider } from '../../lib/overlays';
import { ProjectRouteProvider } from '../../lib/ProjectRouteContext';
import { ChatOverlays } from './components/ChatOverlays';
import { ChatPermissionsProvider } from './context/ChatPermissionsProvider';
import { ChatSessionConfigProvider } from './context/ChatSessionProvider';

interface ChatProps {
  namespace: 'local' | 'dashboard';
}

export function Chat({ namespace }: ChatProps) {
  return (
    <MainSidebarProvider storageKey="mastracode-sidebar" mobileBreakpoint={768}>
      <ProjectRouteProvider namespace={namespace}>
        <ChatSessionRouteProvider>
          <OverlaysProvider>
            <ChatShell />
          </OverlaysProvider>
        </ChatSessionRouteProvider>
      </ProjectRouteProvider>
    </MainSidebarProvider>
  );
}

function ChatSessionRouteProvider({ children }: { children: ReactNode }) {
  const { threadId } = useParams();
  const location = useLocation();
  const userScoped = location.pathname.includes('/user/threads/');

  return (
    <ChatSessionConfigProvider threadId={threadId ? decodeURIComponent(threadId) : undefined} userScoped={userScoped}>
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
