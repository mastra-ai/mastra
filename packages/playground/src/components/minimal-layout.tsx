import { ThemeProvider } from '@mastra/playground-ui/components/ThemeProvider';
import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { AuthRequired } from '@/domains/auth/components/auth-required';

export const MinimalLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="h-screen bg-sidebar">
      <Toaster position="bottom-right" />
      <ThemeProvider defaultTheme="system">
        <div className="h-full overflow-y-auto">
          <AuthRequired>{children}</AuthRequired>
        </div>
      </ThemeProvider>
    </div>
  );
};
