import { MainSidebarProvider } from '@mastra/playground-ui/components/MainSidebar';
import type { ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router';

import { PageLayoutMainViewProvider } from '../../ui/PageLayout';
import { OverlaysProvider, useOverlays } from '../../lib/overlays';
import { SettingsPanel } from '../settings/components/SettingsPanel';
import { SettingsNavigationProvider } from '../settings/context/SettingsNavigationProvider';
import { useActiveFactoryContext } from '../workspaces/context/ActiveFactoryProvider';
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
          <SettingsNavigationProvider>
            <ChatShell />
          </SettingsNavigationProvider>
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
  const overlays = useOverlays();
  const { activeFactory } = useActiveFactoryContext();

  const mainView = overlays.isOpen('settings') ? <SettingsPanel /> : undefined;

  return (
    <>
      {!activeFactory && mainView !== undefined ? (
        <main className="flex h-screen min-h-0 flex-col overflow-hidden bg-surface2">{mainView}</main>
      ) : (
        <PageLayoutMainViewProvider view={mainView}>
          <Outlet />
        </PageLayoutMainViewProvider>
      )}
      <ChatOverlays />
    </>
  );
}
