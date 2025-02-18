import React from 'react';

import { AppSidebar } from './ui/app-sidebar';
import { SidebarProvider } from './ui/sidebar';
import { Toaster } from './ui/sonner';
import { ThemeProvider } from './ui/theme-provider';

export const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <main className="bg-black font-sans">
      <ThemeProvider defaultTheme="dark" attribute="class">
        <SidebarProvider>
          <AppSidebar />
          <section className="h-screen py-3 pr-3 w-full overflow-hidden">
            <div className="h-full w-full overflow-hidden rounded-sm border-[0.5px] border-[#303030] bg-[#0F0F0F]">
              {children}
            </div>
          </section>

          <Toaster position="bottom-right" />
        </SidebarProvider>
      </ThemeProvider>
    </main>
  );
};
