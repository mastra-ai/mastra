import { MainSidebarProvider, useMainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import type { ReactNode } from 'react';
import { Outlet, useLocation, useParams } from 'react-router';

import { PageLayoutMainViewProvider } from '../../ui/PageLayout';
import { OverlaysProvider, useOverlays } from '../../lib/overlays';
import { SettingsPanel } from '../settings/components/SettingsPanel';
import { SettingsNavigationProvider } from '../settings/context/SettingsNavigationProvider';
import { FactoriesPanel } from '../workspaces/components/FactoriesPanel';
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
  // Params from the matched leaf route are visible in this layout, so the
  // thread id comes straight from `/factories/:factoryId/(user/)threads/:threadId`.
  const { threadId } = useParams<{ threadId: string }>();
  const { pathname } = useLocation();
  const userScoped = pathname.includes('/user/threads/');

  return (
    <ChatSessionConfigProvider threadId={threadId} userScoped={userScoped}>
      <ChatPermissionsProvider>{children}</ChatPermissionsProvider>
    </ChatSessionConfigProvider>
  );
}

function ChatShell() {
  const overlays = useOverlays();
  const { activeFactory, factories, factoriesPending } = useActiveFactoryContext();
  const { isMobile } = useMainSidebar();
  const factorySetupRequired = factories.length === 0 && !factoriesPending;
  const factoriesOpen = overlays.isOpen('factories');

  const closeFactories = () => {
    overlays.close('factories');
    const focusTargetId = isMobile ? 'mobile-navigation-trigger' : 'factory-switcher-trigger';
    requestAnimationFrame(() => document.getElementById(focusTargetId)?.focus());
  };

  const mainView = overlays.isOpen('settings') ? (
    <SettingsPanel />
  ) : factoriesOpen ? (
    <FactoriesPanel onClose={factorySetupRequired ? undefined : closeFactories} />
  ) : undefined;

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
