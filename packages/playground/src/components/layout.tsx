import { Button } from '@mastra/playground-ui/components/Button';
import { ErrorBoundary } from '@mastra/playground-ui/components/ErrorBoundary';
import { LogoWithoutText } from '@mastra/playground-ui/components/Logo';
import { ThemeProvider } from '@mastra/playground-ui/components/ThemeProvider';
import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { useIsMobile } from '@mastra/playground-ui/hooks/use-is-mobile';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { AppShell, MainCard } from '@mastra/playground-ui/new/layout/app-shell';
import { SidebarNew, useSidebarNew } from '@mastra/playground-ui/new/sidebar';
import { CollapsiblePanel } from '@mastra/playground-ui/resize/collapsible-panel';
import { PanelDrawer } from '@mastra/playground-ui/resize/panel-drawer';
import { PanelGroup } from '@mastra/playground-ui/resize/panel-group';
import { PanelSeparator } from '@mastra/playground-ui/resize/separator';
import { Search } from 'lucide-react';
import type { CSSProperties } from 'react';
import { Panel, useDefaultLayout } from 'react-resizable-panels';
import { useLocation } from 'react-router';
import { AppSidebar } from './ui/app-sidebar';
import { AuthRequired } from '@/domains/auth/components/auth-required';
import { useAuthCapabilities } from '@/domains/auth/hooks/use-auth-capabilities';
import { isAuthenticated } from '@/domains/auth/types';
import { ExperimentalUIProvider } from '@/domains/experimental-ui/experimental-ui-context';
import { UI_EXPERIMENTS } from '@/domains/experimental-ui/experiments';
import { useExperimentalUIEnabled } from '@/domains/experimental-ui/use-experimental-ui-enabled';
import { SidebarShortcuts } from '@/domains/navigation/components/sidebar-shortcuts';
import { NavigationCommand, useNavigationCommand } from '@/lib/command';
import { RouteSidePanelProvider, RouteSidePanelSlot, useRouteSidePanel } from '@/lib/route-side-panel';
import { cn } from '@/lib/utils';

function MobileNavbar() {
  const { setOpenMobile } = useSidebarNew();
  const { setOpen: setNavigationCommandOpen } = useNavigationCommand({ enableShortcut: false });

  const openNavigationCommand = () => {
    setOpenMobile(false);
    setNavigationCommandOpen(true);
  };

  return (
    <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border bg-sidebar px-3 lg:hidden">
      <div className="flex min-w-0 items-center gap-3">
        <SidebarNew.MobileTrigger />
        <span className="flex min-w-0 items-center gap-2">
          <LogoWithoutText className="size-[1.5rem] shrink-0" />
          <span className="font-display text-body whitespace-nowrap">Mastra Studio</span>
        </span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-md"
        tooltip="Search"
        aria-label="Search and navigate"
        onClick={openNavigationCommand}
        className="shrink-0"
      >
        <Search />
      </Button>
    </header>
  );
}

// First visit: the panel starts collapsed; `useDefaultLayout` persists later widths.
const SIDE_PANEL_COLLAPSED_LAYOUT = { 'studio-frame': 100, 'route-side-panel': 0 };

// `Group` and `Panel` hardcode `overflow: hidden`/`auto` inline, which would clip the
// frame's rim and shadow. Only the `style` prop beats it; the frame clips its own content.
const UNCLIPPED: CSSProperties = { overflow: 'visible' };

/**
 * Hosts the page-registered side panel next to the Studio frame (outside the
 * rounded card). Desktop: resizable panel; mobile: edge drawer. The page always
 * renders under the same `Panel` so crossing the breakpoint never remounts it.
 */
export function StudioFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  const isMobile = useIsMobile();
  const { hasPanel, panelHandle, onPanelResize } = useRouteSidePanel();
  const { defaultLayout, onLayoutChange } = useDefaultLayout({
    id: 'studio-frame-layout-v1',
    storage: localStorage,
  });

  return (
    <div className="relative flex min-h-0 flex-1">
      <PanelGroup
        className="min-h-0 flex-1"
        style={UNCLIPPED}
        orientation="horizontal"
        defaultLayout={defaultLayout ?? SIDE_PANEL_COLLAPSED_LAYOUT}
        onLayoutChange={onLayoutChange}
      >
        <Panel id="studio-frame" className={cn('min-w-0', className)} style={UNCLIPPED}>
          {children}
        </Panel>
        {hasPanel && !isMobile && (
          <>
            <PanelSeparator />
            <CollapsiblePanel
              id="route-side-panel"
              ref={panelHandle}
              direction="right"
              collapsible
              collapsedSize={0}
              hideExpandButton
              minSize={320}
              maxSize="50%"
              defaultSize={380}
              className="min-w-0"
              onResize={size => onPanelResize(size.inPixels)}
            >
              <RouteSidePanelSlot className="h-full min-h-0" />
            </CollapsiblePanel>
          </>
        )}
      </PanelGroup>
      {hasPanel && isMobile && (
        <PanelDrawer direction="right" label="Open details panel">
          <RouteSidePanelSlot className="h-full min-h-0" />
        </PanelDrawer>
      )}
    </div>
  );
}

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { data: authCapabilities, isFetched } = useAuthCapabilities();
  const { pathname } = useLocation();
  // Optimistic: render chrome by default so cold loads don't jump.
  const shouldHideSidebar = isFetched && authCapabilities?.enabled && !isAuthenticated(authCapabilities);
  const shouldShowSidebar = !shouldHideSidebar;

  return (
    <>
      <NavigationCommand />
      <AppShell
        sidebar={shouldShowSidebar ? <AppSidebar /> : undefined}
        mobileHeader={shouldShowSidebar ? <MobileNavbar /> : undefined}
      >
        <StudioFrame className="flex min-h-0 flex-1 flex-col">
          <MainCard>
            <AuthRequired>
              <ErrorBoundary resetKeys={[pathname]}>{children}</ErrorBoundary>
            </AuthRequired>
          </MainCard>
        </StudioFrame>
      </AppShell>
    </>
  );
}

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const { experimentalUIEnabled } = useExperimentalUIEnabled();
  const { Link } = useLinkComponent();

  return (
    <div className="h-screen bg-sidebar font-body">
      <Toaster position="bottom-right" />
      <ThemeProvider defaultTheme="system">
        <TooltipProvider delayDuration={0}>
          <ExperimentalUIProvider experiments={experimentalUIEnabled ? UI_EXPERIMENTS : []}>
            <SidebarNew.Provider LinkComponent={Link}>
              <SidebarShortcuts />
              <RouteSidePanelProvider>
                <LayoutContent>{children}</LayoutContent>
              </RouteSidePanelProvider>
            </SidebarNew.Provider>
          </ExperimentalUIProvider>
        </TooltipProvider>
      </ThemeProvider>
    </div>
  );
};
