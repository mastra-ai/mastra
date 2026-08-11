import { ThemeProvider } from '@mastra/playground-ui/components/ThemeProvider';
import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { AuthRequired } from '@/domains/auth/components/auth-required';

export const MinimalLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="bg-surface1 h-screen font-sans">
      <Toaster position="bottom-right" />
      <ThemeProvider defaultTheme="system">
        <TooltipProvider delayDuration={0}>
          <div className="h-full overflow-y-auto">
            <AuthRequired>{children}</AuthRequired>
          </div>
        </TooltipProvider>
      </ThemeProvider>
    </div>
  );
};
