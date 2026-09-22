import { ThemeProvider } from '@mastra/playground-ui/components/ThemeProvider';
import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { AppShell } from '@mastra/playground-ui/new/layout/app-shell';
import { Outlet } from 'react-router';
import { StudioCard } from './studio-card';

// Shell for `/login` and `/signup`: same providers and Studio card as the app, no sidebar, no auth gate.
export function AuthLayout() {
  return (
    <div className="bg-sidebar font-body h-screen">
      <Toaster position="bottom-right" />
      <ThemeProvider defaultTheme="system">
        <TooltipProvider delayDuration={0}>
          <AppShell>
            <StudioCard className="flex items-center justify-center overflow-y-auto">
              <Outlet />
            </StudioCard>
          </AppShell>
        </TooltipProvider>
      </ThemeProvider>
    </div>
  );
}
