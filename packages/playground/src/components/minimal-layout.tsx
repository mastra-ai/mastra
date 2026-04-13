import { Toaster, TooltipProvider } from '@mastra/playground-ui';
import { AuthRequired } from '@/domains/auth/components/auth-required';
import { ThemeProvider } from './ui/theme-provider';

export const MinimalLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="bg-surface1 font-sans h-screen">
      <Toaster position="bottom-right" />
      <ThemeProvider defaultTheme="dark" attribute="class">
        <TooltipProvider delayDuration={0}>
          <div className="h-full overflow-y-auto">
            <AuthRequired>{children}</AuthRequired>
          </div>
        </TooltipProvider>
      </ThemeProvider>
    </div>
  );
};
