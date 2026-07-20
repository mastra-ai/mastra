import { Button } from '@mastra/playground-ui/components/Button';
import { ErrorBoundary } from '@mastra/playground-ui/components/ErrorBoundary';
import { LogoWithoutText } from '@mastra/playground-ui/components/Logo';
import { MainSidebar, MainSidebarProvider, useMainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { PageHeadingContext } from '@mastra/playground-ui/components/PageLayout';
import { ThemeProvider } from '@mastra/playground-ui/components/ThemeProvider';
import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { Search } from 'lucide-react';
import { useLocation } from 'react-router';
import { AppSidebar } from './ui/app-sidebar';
import { AuthRequired } from '@/domains/auth/components/auth-required';
import { useAuthCapabilities } from '@/domains/auth/hooks/use-auth-capabilities';
import { isAuthenticated } from '@/domains/auth/types';
import { ExperimentalUIProvider } from '@/domains/experimental-ui/experimental-ui-context';
import { UI_EXPERIMENTS } from '@/domains/experimental-ui/experiments';
import { useExperimentalUIEnabled } from '@/domains/experimental-ui/use-experimental-ui-enabled';
import { NavigationCommand, useNavigationCommand } from '@/lib/command';
import {
  RouteHeader,
  RouteHeaderActionsProvider,
  RouteHeaderCrumbsProvider,
  getRouteHeaderHeading,
  useRouteHeader,
  useRouteHeaderCrumbsOverride,
} from '@/lib/route-header';
import { cn } from '@/lib/utils';

function MobileNavbar() {
  const { setOpenMobile } = useMainSidebar();
  const { setOpen: setNavigationCommandOpen } = useNavigationCommand({ enableShortcut: false });

  const openNavigationCommand = () => {
    setOpenMobile(false);
    setNavigationCommandOpen(true);
  };

  return (
    <header className="border-border1 bg-surface1 sticky top-0 z-20 flex h-12 shrink-0 items-center justify-between gap-3 border-b px-3 lg:hidden">
      <div className="flex min-w-0 items-center gap-3">
        <MainSidebar.MobileTrigger />
        <span className="flex min-w-0 items-center gap-2">
          <LogoWithoutText className="size-[1.5rem] shrink-0" />
          <span className="font-display text-sm whitespace-nowrap">Mastra Studio</span>
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

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { data: authCapabilities, isFetched } = useAuthCapabilities();
  const { pathname } = useLocation();
  const { crumbs: handleCrumbs } = useRouteHeader();
  const overrideCrumbs = useRouteHeaderCrumbsOverride();
  const pageHeading = getRouteHeaderHeading(overrideCrumbs ?? handleCrumbs);
  // Optimistic: render chrome by default so cold loads don't jump.
  const shouldHideSidebar = isFetched && authCapabilities?.enabled && !isAuthenticated(authCapabilities);
  const shouldShowSidebar = !shouldHideSidebar;

  return (
    <>
      <NavigationCommand />
      <div className={cn('h-full', shouldShowSidebar && 'lg:grid lg:grid-cols-[auto_1fr] lg:grid-rows-[1fr]')}>
        {shouldShowSidebar && <AppSidebar />}
        <div className="flex h-full min-h-0 flex-col">
          {shouldShowSidebar && <MobileNavbar />}
          {shouldShowSidebar && (
            <div className="mx-1.5 mt-1 shrink-0 lg:mx-2 lg:mt-1.5">
              <RouteHeader />
            </div>
          )}
          <PageHeadingContext.Provider value={pageHeading}>
            <div
              className={cn(
                'ml-0 mx-1.5 mb-1.5 flex-1 min-h-0 overflow-y-auto [--studio-frame-radius:1.5rem] [--studio-frame-inset:0.5rem] rounded-studio-frame border border-border1 bg-surface2 shadow-main-frame lg:mx-2 lg:mb-2 lg:ml-0',
                shouldShowSidebar ? 'mt-0' : 'mt-1.5 lg:mt-2 h-[calc(100%-1.5rem)]',
              )}
            >
              <AuthRequired>
                <ErrorBoundary resetKeys={[pathname]}>{children}</ErrorBoundary>
              </AuthRequired>
            </div>
          </PageHeadingContext.Provider>
        </div>
      </div>
    </>
  );
}

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const { experimentalUIEnabled } = useExperimentalUIEnabled();

  return (
    <div className="bg-surface1 h-screen font-sans">
      <Toaster position="bottom-right" />
      <ThemeProvider defaultTheme="system">
        <TooltipProvider delayDuration={0}>
          <ExperimentalUIProvider experiments={experimentalUIEnabled ? UI_EXPERIMENTS : []}>
            <MainSidebarProvider>
              <RouteHeaderActionsProvider>
                <RouteHeaderCrumbsProvider>
                  <LayoutContent>{children}</LayoutContent>
                </RouteHeaderCrumbsProvider>
              </RouteHeaderActionsProvider>
            </MainSidebarProvider>
          </ExperimentalUIProvider>
        </TooltipProvider>
      </ThemeProvider>
    </div>
  );
};
