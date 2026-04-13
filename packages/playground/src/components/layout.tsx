import { MainSidebarProvider, Toaster, TooltipProvider } from '@mastra/playground-ui';
import { AppSidebar } from './ui/app-sidebar';
import { ThemeProvider } from './ui/theme-provider';
import { AuthRequired } from '@/domains/auth/components/auth-required';
import { useAuthCapabilities } from '@/domains/auth/hooks/use-auth-capabilities';
import { isAuthenticated } from '@/domains/auth/types';
import { ExperimentalUIProvider } from '@/domains/experimental-ui/experimental-ui-context';
import { UI_EXPERIMENTS } from '@/domains/experimental-ui/experiments';
import { useExperimentalUIEnabled } from '@/domains/experimental-ui/use-experimental-ui-enabled';
import { NavigationCommand } from '@/lib/command';
import { cn } from '@/lib/utils';

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { data: authCapabilities, isFetched } = useAuthCapabilities();
  const shouldHideSidebar = isFetched && authCapabilities?.enabled && !isAuthenticated(authCapabilities);
  const shouldShowSidebar = isFetched && !shouldHideSidebar;

  return (
    <>
      <NavigationCommand />
      <div className={shouldShowSidebar ? 'grid h-full grid-cols-[auto_1fr]' : 'h-full'}>
        {shouldShowSidebar && <AppSidebar />}
        <div
          className={cn('bg-transparent overflow-y-auto', {
            'h-[calc(100%-1.5rem)]': shouldHideSidebar,
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
