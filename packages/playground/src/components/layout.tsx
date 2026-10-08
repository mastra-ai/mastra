import { ErrorBoundary } from '@mastra/playground-ui/components/ErrorBoundary';
import { PageLayoutHeaderContext } from '@mastra/playground-ui/components/PageLayout';
import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { ThemeProvider } from '@mastra/playground-ui/components/ThemeProvider';
import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { useIsMobile } from '@mastra/playground-ui/hooks/use-is-mobile';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { AppShell, MainCard } from '@mastra/playground-ui/new/layout/app-shell';
import { CollapsiblePanel } from '@mastra/playground-ui/resize/collapsible-panel';
import { PanelDrawer } from '@mastra/playground-ui/resize/panel-drawer';
import { PanelGroup } from '@mastra/playground-ui/resize/panel-group';
import { PanelSeparator } from '@mastra/playground-ui/resize/separator';
import { useAuthCapabilities, isAuthenticated } from '@mastra/react/hooks/auth';
import type { CSSProperties } from 'react';
import { Panel, useDefaultLayout } from 'react-resizable-panels';
import { useLocation } from 'react-router';
import { MobileHeaderProvider } from './mobile-header-provider';
import { MobileNavbar } from './mobile-navbar';
import { MobilePageHeader } from './mobile-page-header';
import { StudioSidebar } from './ui/studio-sidebar';
import { AuthRequired } from '@/domains/auth/components/auth-required';
import { ImpersonationBanner } from '@/domains/auth/components/impersonation-banner';
import { ExperimentalUIProvider } from '@/domains/experimental-ui/experimental-ui-context';
import { UI_EXPERIMENTS } from '@/domains/experimental-ui/experiments';
import { useExperimentalUIEnabled } from '@/domains/experimental-ui/use-experimental-ui-enabled';
import { NavigationCommand } from '@/lib/command';
import { RouteSidePanelProvider, RouteSidePanelSlot, useRouteSidePanel } from '@/lib/route-side-panel';
import { cn } from '@/lib/utils';

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
  // A page without a side panel must not overwrite the saved two-panel layout.
  const sidePanelLayout =
    defaultLayout?.['route-side-panel'] === undefined ? SIDE_PANEL_COLLAPSED_LAYOUT : defaultLayout;

  return (
    <div className="relative flex min-h-0 flex-1">
      <PanelGroup
        className="relative z-0 min-h-0 flex-1"
        style={UNCLIPPED}
        orientation="horizontal"
        defaultLayout={sidePanelLayout}
        onLayoutChange={hasPanel ? onLayoutChange : undefined}
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
              <RouteSidePanelSlot className="h-full min-h-0 pl-2" />
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
  const isMobile = useIsMobile();
  const { data: authCapabilities, isFetched } = useAuthCapabilities();
  const { pathname } = useLocation();
  // Optimistic: render chrome by default so cold loads don't jump.
  const shouldHideSidebar = isFetched && authCapabilities?.enabled && !isAuthenticated(authCapabilities);
  const shouldShowSidebar = !shouldHideSidebar;

  return (
    <PageLayoutHeaderContext.Provider value={isMobile && shouldShowSidebar ? MobilePageHeader : undefined}>
      <NavigationCommand />
      <AppShell
        className="[--border:var(--surface-rim)] [--studio-frame-radius:1rem] max-lg:[&_[data-slot=app-shell-body]]:p-0 lg:[&_[data-slot=app-shell-body]]:py-1 lg:[&_[data-slot=app-shell-body]]:pr-1"
        sidebar={shouldShowSidebar ? <StudioSidebar /> : undefined}
        mobileHeader={shouldShowSidebar ? <MobileNavbar /> : undefined}
      >
        <StudioFrame className="flex min-h-0 flex-1 flex-col">
          <MainCard className="flex min-h-0 flex-col max-lg:rounded-none max-lg:p-0 max-lg:shadow-none">
            <div
              data-slot="studio-frame-content"
              className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-studio-panel [--studio-frame-inset:1px] max-lg:rounded-none"
            >
              <ImpersonationBanner />
              <AuthRequired>
                <ErrorBoundary resetKeys={[pathname]}>{children}</ErrorBoundary>
              </AuthRequired>
            </div>
          </MainCard>
        </StudioFrame>
      </AppShell>
    </PageLayoutHeaderContext.Provider>
  );
}

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const { experimentalUIEnabled } = useExperimentalUIEnabled();
  const { Link } = useLinkComponent();

  return (
    <div className="h-screen bg-sidebar">
      <Toaster position="bottom-right" />
      <ThemeProvider defaultTheme="system">
        <TooltipProvider delayDuration={0}>
          <ExperimentalUIProvider experiments={experimentalUIEnabled ? UI_EXPERIMENTS : []}>
            <Sidebar.Provider
              LinkComponent={Link}
              defaultState="collapsed"
              storageKey="mastra:studio:rail"
              defaultWidth={48}
              minWidth={48}
              maxWidth={48}
            >
              <RouteSidePanelProvider>
                <MobileHeaderProvider>
                  <LayoutContent>{children}</LayoutContent>
                </MobileHeaderProvider>
              </RouteSidePanelProvider>
            </Sidebar.Provider>
          </ExperimentalUIProvider>
        </TooltipProvider>
      </ThemeProvider>
    </div>
  );
};
