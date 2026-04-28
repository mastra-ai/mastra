import { ThemeProvider, Toaster, TooltipProvider } from '@mastra/playground-ui';
import { AuthRequired } from '@/domains/auth/components/auth-required';

export const MinimalLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="bg-surface1 font-sans h-screen">
      <Toaster position="bottom-right" />
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider delayDuration={0}>
          <div className="h-full overflow-y-auto">
            <AuthRequired>{children}</AuthRequired>
          </div>
        </TooltipProvider>
      </ThemeProvider>
    </div>
  );
};
