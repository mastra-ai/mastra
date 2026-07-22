import { MainSidebarProvider, useMainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import type { ReactNode } from 'react';
import { Outlet, useMatch } from 'react-router';

import { PageLayoutMainViewProvider } from '../../ui/PageLayout';
import { OverlaysProvider, useOverlays } from '../../lib/overlays';
import { SettingsPanel } from '../settings/components/SettingsPanel';
import { SettingsHeader } from '../settings/components/SettingsHeader';
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
  // `useParams` in a layout can't see descendant params, so match the thread
  // routes explicitly (params come back already decoded).
  const userThreadMatch = useMatch('/factories/:factoryId/user/threads/:threadId');
  const factoryThreadMatch = useMatch('/factories/:factoryId/threads/:threadId');
  const userScoped = userThreadMatch !== null;
  const threadId = userThreadMatch?.params.threadId ?? factoryThreadMatch?.params.threadId;

  return (
    <ChatSessionConfigProvider threadId={threadId} userScoped={userScoped}>
      <ChatPermissionsProvider>{children}</ChatPermissionsProvider>
    </ChatSessionConfigProvider>
  );
}

function ChatShell() {
  const overlays = useOverlays();
  const { activeFactory } = useActiveFactoryContext();
  const { isMobile } = useMainSidebar();
  const settingsOpen = overlays.isOpen('settings');

  const mainView = settingsOpen ? <SettingsPanel /> : undefined;

  return (
    <>
      {!activeFactory && mainView !== undefined ? (
        <main className="flex h-screen min-h-0 flex-col overflow-hidden bg-surface2">
          {settingsOpen && isMobile ? <SettingsHeader autoFocus placement="mobile" /> : undefined}
          {mainView}
        </main>
      ) : (
        <PageLayoutMainViewProvider
          view={mainView}
          mobileHeader={settingsOpen ? <SettingsHeader autoFocus={isMobile} placement="mobile" /> : undefined}
        >
          <Outlet />
        </PageLayoutMainViewProvider>
      )}
      <ChatOverlays />
    </>
  );
}
