import { MainSidebarProvider } from '@mastra/playground-ui/components/MainSidebar';
import type { ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router';

import { OverlaysProvider } from '../../lib/overlays';
import { ProjectRouteProvider } from '../../lib/ProjectRouteContext';
import { ActiveFactoryProvider } from '../workspaces';
import { ChatOverlays } from './components/ChatOverlays';
import { ChatSessionConfigProvider } from './context/ChatSessionProvider';
import { ChatPermissionsProvider } from './context/ChatPermissionsProvider';

/**
 * Shared chat app providers. Route leaves render their own pages so `/new` is a
 * real page boundary instead of a branch inside the thread transcript.
 */
export default function Chat({ factoryId, namespace }: { factoryId: string; namespace: 'local' | 'dashboard' }) {
  return (
    <MainSidebarProvider storageKey="mastracode-web" collapsedWidth={0} mobileBreakpoint={768}>
      <ActiveFactoryProvider factoryId={factoryId}>
        <ProjectRouteProvider namespace={namespace}>
          <ChatSessionRouteProvider>
            <OverlaysProvider>
              <ChatShell />
            </OverlaysProvider>
          </ChatSessionRouteProvider>
        </ProjectRouteProvider>
      </ActiveFactoryProvider>
    </MainSidebarProvider>
  );
}

function ChatSessionRouteProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const userThreadMatch = pathname.match(/\/user\/threads\/([^/]+)$/);
  const projectThreadMatch = pathname.match(/\/threads\/([^/]+)$/);
  const userScoped = Boolean(userThreadMatch);
  const encodedThreadId = userThreadMatch?.[1] ?? projectThreadMatch?.[1];
  const threadId = encodedThreadId ? decodeURIComponent(encodedThreadId) : undefined;

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
