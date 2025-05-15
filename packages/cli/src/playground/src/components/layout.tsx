import React from 'react';

import { AppSidebar } from './ui/app-sidebar';
import { SidebarProvider } from './ui/sidebar';
import { Toaster } from './ui/sonner';
import { ThemeProvider } from './ui/theme-provider';

export const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="bg-surface1 overflow-hidden font-sans">
      <ThemeProvider defaultTheme="dark" attribute="class">
        <SidebarProvider>
          <AppSidebar />

          <main className="py-3 pr-3 w-full h-full">
            <div className="w-full h-full overflow-hidden rounded-lg border-sm border-border1 bg-surface2">
              {children}
            </div>
          </main>

          <Toaster position="bottom-right" />
        </SidebarProvider>
      </ThemeProvider>
    </div>
  );
};
