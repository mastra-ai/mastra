import { MainSidebarProvider, useMainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import type { ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router';

import { PageLayoutMainViewProvider } from '../../ui/PageLayout';
import { OverlaysProvider, useOverlays } from '../../lib/overlays';
import { SettingsPanel } from '../settings/components/SettingsPanel';
import { SettingsHeader } from '../settings/components/SettingsHeader';
import { SettingsNavigationProvider } from '../settings/context/SettingsNavigationProvider';
import { FactoriesPanel } from '../workspaces/components/FactoriesPanel';
import { ActiveFactoryProvider, useActiveFactoryContext } from '../workspaces/context/ActiveFactoryProvider';
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
  const { factories, factoriesPending } = useActiveFactoryContext();
  const { isMobile } = useMainSidebar();
  const factorySetupRequired = factories.length === 0 && !factoriesPending;
  const factoriesOpen = overlays.isOpen('factories');
  const settingsOpen = overlays.isOpen('settings');

  const closeFactories = () => {
    overlays.close('factories');
    const focusTargetId = isMobile ? 'mobile-navigation-trigger' : 'factory-switcher-trigger';
    requestAnimationFrame(() => document.getElementById(focusTargetId)?.focus());
  };

  const mainView = settingsOpen ? (
    <SettingsPanel />
  ) : factoriesOpen ? (
    <FactoriesPanel onClose={factorySetupRequired ? undefined : closeFactories} />
  ) : undefined;

  return (
    <>
      <PageLayoutMainViewProvider
        view={mainView}
        mobileHeader={settingsOpen ? <SettingsHeader autoFocus={isMobile} placement="mobile" /> : undefined}
      >
        <Outlet />
      </PageLayoutMainViewProvider>
      <ChatOverlays />
    </>
  );
}
