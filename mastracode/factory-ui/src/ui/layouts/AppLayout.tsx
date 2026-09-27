import { useMainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { AppShell, MainCard } from '@mastra/playground-ui/new/layout/app-shell';
import { SidebarNew } from '@mastra/playground-ui/new/sidebar';
import { Outlet } from 'react-router';

import { ChatSessionRouteProvider } from '../domains/chat/Chat';
import { ChatOverlays } from '../domains/chat/components/ChatOverlays';
import { GlobalSearchButton } from '../domains/search/components/GlobalSearchButton';
import { OverlaysProvider } from '../lib/overlays';
import { Sidebar } from '../Sidebar';

/**
 * Mobile-only bar above the page frame: the drawer trigger and global search.
 * Keyed off the sidebar's own media signal so it can never desync from the drawer.
 */
function MobileHeader() {
  const { isMobile } = useMainSidebar();
  if (!isMobile) return null;

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 px-3">
      <SidebarNew.MobileTrigger id="mobile-navigation-trigger" />
      <div className="ml-auto shrink-0">
        <GlobalSearchButton id="global-search-mobile-trigger" />
      </div>
    </header>
  );
}

/**
 * Application frame rendered once at the router level: sidebar + page card
 * around the routed page. Pages render only their body (see `PageLayout`).
 * Mounted under `FactoryLayout` so the sidebar only ever sees a valid factory.
 */
export function AppLayout() {
  return (
    <div className="bg-sidebar h-dvh">
      <SidebarNew.Provider storageKey="mastracode-web" collapsedWidth={0}>
        <OverlaysProvider>
          <ChatSessionRouteProvider>
            <AppShell sidebar={<Sidebar />} mobileHeader={<MobileHeader />}>
              <MainCard className="flex flex-col">
                <Outlet />
              </MainCard>
            </AppShell>
            <ChatOverlays />
          </ChatSessionRouteProvider>
        </OverlaysProvider>
      </SidebarNew.Provider>
    </div>
  );
}
