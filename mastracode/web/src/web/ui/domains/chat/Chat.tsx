import { MainSidebarProvider } from '@mastra/playground-ui/components/MainSidebar';
import type { ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router';

import { PageLayoutMainViewProvider } from '../../ui/PageLayout';
import { OverlaysProvider, useOverlays } from '../../lib/overlays/overlays';
import { SettingsPanel } from '../settings/components/SettingsPanel';
import { SettingsNavigationProvider } from '../settings/context/SettingsNavigationProvider';
import { ActiveFactoryProvider } from '../workspaces/context/ActiveFactoryProvider';
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
      <ActiveFactoryProvider>
        <ChatSessionRouteProvider>
          <OverlaysProvider>
            <SettingsNavigationProvider>
              <ChatShell />
            </SettingsNavigationProvider>
          </OverlaysProvider>
        </ChatSessionRouteProvider>
      </ActiveFactoryProvider>
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
  const overlays = useOverlays();
  return (
    <>
      <PageLayoutMainViewProvider view={overlays.isOpen('settings') ? <SettingsPanel /> : undefined}>
        <Outlet />
      </PageLayoutMainViewProvider>
      <ChatOverlays />
    </>
  );
}
