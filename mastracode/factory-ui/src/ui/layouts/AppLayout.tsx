import { BrandLoader } from '@mastra/playground-ui/components/BrandLoader';
import { Sidebar, useSidebar } from '@mastra/playground-ui/components/Sidebar';
import { useKeydown } from '@mastra/playground-ui/keyboard/use-keydown';
import { AppShell, MainCard } from '@mastra/playground-ui/new/layout/app-shell';
import { Suspense } from 'react';
import { Outlet, useMatches } from 'react-router';

import { ChatSessionRouteProvider } from '../domains/chat/Chat';
import { ChatOverlays } from '../domains/chat/components/ChatOverlays';
import { GlobalSearchButton } from '../domains/search/components/GlobalSearchButton';
import { OverlaysProvider } from '../lib/overlays';
import { AppSidebar } from '../AppSidebar';

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

/** Route `handle` for session pages: they share one loading boundary, so moving between them never shows the loader. */
export const sessionPageHandle = Symbol('session page');

// Navigations run in a transition, where a boundary already showing a page keeps
// it instead of the loader, so each page needs its own boundary.
function RoutedPage() {
  const page = useMatches().at(-1);

  return (
    <Suspense
      key={page?.handle === sessionPageHandle ? 'session' : page?.id}
      fallback={
        <div className="flex flex-1 items-center justify-center transition-opacity delay-150 starting:opacity-0">
          <BrandLoader size="lg" aria-label="Loading page" />
        </div>
      }
    >
      <Outlet />
    </Suspense>
  );
}

function AppFrame() {
  const { state, collapsedWidth } = useSidebar();
  const edgeToEdge = state === 'collapsed' && collapsedWidth === 0;

  return (
    <AppShell sidebar={<AppSidebar />} mobileHeader={<MobileHeader />} edgeToEdge={edgeToEdge}>
      <MainCard className="flex flex-col" edgeToEdge={edgeToEdge}>
        <RoutedPage />
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
  return (
    <div className="bg-sidebar h-dvh">
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
  );
}
