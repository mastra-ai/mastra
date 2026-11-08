import { Sidebar, useSidebar } from '@mastra/playground-ui/components/Sidebar';
import { useKeydown } from '@mastra/playground-ui/keyboard/use-keydown';
import { AppShell, MainCard } from '@mastra/playground-ui/new/layout/app-shell';
import { Outlet } from 'react-router';

import { ChatSessionRouteProvider } from '../domains/chat/Chat';
import { ChatOverlays } from '../domains/chat/components/ChatOverlays';
import { OverlaysProvider } from '../lib/overlays';
import { PwaInstallBanner } from '../lib/pwa';
import { AppSidebar } from '../AppSidebar';

/** `[` toggles the sidebar, as the trigger's tooltip says. Needs the `Sidebar.Provider` context. */
function SidebarShortcuts() {
  const { toggleSidebar } = useSidebar();
  useKeydown({ '[': toggleSidebar }, { repeat: false });
  return null;
}

function AppFrame() {
  const { state, collapsedWidth } = useSidebar();
  const edgeToEdge = state === 'collapsed' && collapsedWidth === 0;

  return (
    <AppShell sidebar={<AppSidebar />} edgeToEdge={edgeToEdge}>
      <MainCard className="flex flex-col" edgeToEdge={edgeToEdge}>
        <Outlet />
      </MainCard>
    </AppShell>
  );
}

/**
 * Application frame rendered once at the router level: sidebar + page card
 * around the routed page. Pages render only their body (see `PageLayout`).
 * Mounted under `FactoryLayout` so the sidebar only ever sees a valid factory.
 * The mobile PWA install banner takes the top row so it never covers the page.
 */
export function AppLayout() {
  return (
    <div className="bg-sidebar flex h-dvh flex-col">
      <PwaInstallBanner />
      <div className="min-h-0 flex-1">
        <Sidebar.Provider storageKey="mastracode-web" collapsedWidth={0}>
          <SidebarShortcuts />
          <OverlaysProvider>
            <ChatSessionRouteProvider>
              <AppFrame />
              <ChatOverlays />
            </ChatSessionRouteProvider>
          </OverlaysProvider>
        </Sidebar.Provider>
      </div>
    </div>
  );
}
