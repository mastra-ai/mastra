import { ThemeProvider } from '@mastra/playground-ui/components/ThemeProvider';
import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { AppShell, MainCard } from '@mastra/playground-ui/new/layout/app-shell';
import { Outlet } from 'react-router';

// Shell for `/login` and `/signup`: same providers and Studio card as the app, no sidebar, no auth gate.
export function AuthLayout() {
  return (
    <div className="h-screen bg-sidebar font-body">
      <Toaster position="bottom-right" />
      <ThemeProvider defaultTheme="system">
        <TooltipProvider delayDuration={0}>
          <AppShell>
            <MainCard className="flex items-center justify-center overflow-y-auto">
              <Outlet />
            </MainCard>
          </AppShell>
        </TooltipProvider>
      </ThemeProvider>
    </div>
  );
}
