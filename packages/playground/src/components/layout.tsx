import {
  AuthRequired,
  MainSidebarProvider,
  NavigationCommand,
  Toaster,
  TooltipProvider,
  useAuthCapabilities,
  isAuthenticated,
} from '@mastra/playground-ui';
import { ExperimentalUIProvider, useExperimentalUI } from '@/domains/experimental-ui/experimental-ui-context';
import { cn } from '@/lib/utils';
import { useLocation } from 'react-router';
import { AppSidebar } from './ui/app-sidebar';
import { ThemeProvider } from './ui/theme-provider';
import { UI_EXPERIMENTS } from '@/domains/experimental-ui/experiments';
import { useExperimentalUIEnabled } from '@/domains/experimental-ui/use-experimental-ui-enabled';

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { data: authCapabilities, isFetched } = useAuthCapabilities();
  const shouldHideSidebar = isFetched && authCapabilities?.enabled && !isAuthenticated(authCapabilities);
  const shouldShowSidebar = isFetched && !shouldHideSidebar;
  const { pathname } = useLocation();
  const isMetricsDashboardPage = pathname === '/metrics';
  const { variant } = useExperimentalUI('entity-list-page');

  const agentListExperiment = UI_EXPERIMENTS.find(e => e.key === 'entity-list-page');
  const experimentPaths: string[] = Array.isArray(agentListExperiment?.path)
    ? agentListExperiment.path
    : agentListExperiment?.path
      ? [agentListExperiment.path]
      : [];
  const isPageListNewUIProposal = variant === 'new-proposal' && experimentPaths.includes(pathname);

  return (
    <>
      <NavigationCommand />
      <div className={shouldShowSidebar ? 'grid h-full grid-cols-[auto_1fr]' : 'h-full'}>
        {shouldShowSidebar && <AppSidebar />}
        <div
          className={cn('bg-surface2 my-3 rounded-lg border border-border1 overflow-y-auto mr-3', {
            'h-[calc(100%-1.5rem)] mx-3': shouldHideSidebar,
            'bg-transparent my-0 mr-0': isPageListNewUIProposal || isMetricsDashboardPage,
          })}
        >
          <AuthRequired>{children}</AuthRequired>
        </div>
      </div>
    </>
  );
}

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const { experimentalUIEnabled } = useExperimentalUIEnabled();

  return (
    <div className="bg-surface1 font-sans h-screen">
      <Toaster position="bottom-right" />
      <ThemeProvider defaultTheme="dark" attribute="class">
        <TooltipProvider delayDuration={0}>
          <ExperimentalUIProvider experiments={experimentalUIEnabled ? UI_EXPERIMENTS : []}>
            <MainSidebarProvider>
              <LayoutContent>{children}</LayoutContent>
            </MainSidebarProvider>
          </ExperimentalUIProvider>
        </TooltipProvider>
      </ThemeProvider>
    </div>
  );
};
