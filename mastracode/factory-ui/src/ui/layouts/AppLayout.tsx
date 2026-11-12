import { Sidebar, useSidebar } from '@mastra/playground-ui/components/Sidebar';
import { useKeydown } from '@mastra/playground-ui/keyboard/use-keydown';
import { AppShell, MainCard } from '@mastra/playground-ui/new/layout/app-shell';
import { createPortal } from 'react-dom';
import { Outlet } from 'react-router';

import { ChatSessionRouteProvider } from '../domains/chat/Chat';
import { ChatOverlays } from '../domains/chat/components/ChatOverlays';
import { GlobalSearchButton } from '../domains/search/components/GlobalSearchButton';
import { OverlaysProvider } from '../lib/overlays';
import { AppSidebar, EmbeddedSidebarNav } from '../AppSidebar';
import { useFactoryEmbed } from '../lib/embed';

/**
 * Mobile-only bar above the page frame: the drawer trigger and global search.
 * Keyed off the sidebar's own media signal so it can never desync from the drawer.
 */
function MobileHeader() {
  const { isMobile } = useSidebar();
  if (!isMobile) return null;

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 px-3">
      <Sidebar.MobileTrigger id="mobile-navigation-trigger" />
      <div className="ml-auto shrink-0">
        <GlobalSearchButton id="global-search-mobile-trigger" />
      </div>
    </header>
  );
}

/** `[` toggles the sidebar, as the trigger's tooltip says. Needs the `Sidebar.Provider` context. */
function SidebarShortcuts() {
  const { toggleSidebar } = useSidebar();
  useKeydown({ '[': toggleSidebar }, { repeat: false });
  return null;
}

/** Host-chrome frame: the page fills the host's content area and the nav portals into its sidebar. */
function EmbeddedFrame({ sidebarContainer }: { sidebarContainer: HTMLElement | null }) {
  return (
    <>
      {sidebarContainer &&
        createPortal(
          <nav aria-label="Factory" className="flex min-h-0 flex-1 flex-col">
            <EmbeddedSidebarNav />
          </nav>,
          sidebarContainer,
        )}
      <div className="flex h-full min-h-0 flex-col">
        <Outlet />
      </div>
    </>
  );
}

function AppFrame() {
  const { state, collapsedWidth } = useSidebar();
  const edgeToEdge = state === 'collapsed' && collapsedWidth === 0;

  return (
    <AppShell sidebar={<AppSidebar />} mobileHeader={<MobileHeader />} edgeToEdge={edgeToEdge}>
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
 */
export function AppLayout() {
  const embed = useFactoryEmbed();
  return (
    <div className={embed ? 'h-full' : 'bg-sidebar h-dvh'}>
      <Sidebar.Provider storageKey="mastracode-web" collapsedWidth={0}>
        <SidebarShortcuts />
        <OverlaysProvider>
          <ChatSessionRouteProvider>
            {embed ? <EmbeddedFrame sidebarContainer={embed.sidebarContainer} /> : <AppFrame />}
            <ChatOverlays />
          </ChatSessionRouteProvider>
        </OverlaysProvider>
      </Sidebar.Provider>
    </div>
  );
}
