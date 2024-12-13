import React from 'react';

import { Sidebar } from './ui/sidebar';
import { Toaster } from './ui/sonner';
import { ThemeProvider } from './ui/theme-provider';

export const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <ThemeProvider defaultTheme="dark" attribute="class">
      <Toaster position="bottom-right" />
      <main className="bg-background grid h-full w-full grid-cols-[15rem_minmax(0,_1fr)] overflow-clip">
        <div className="z-20 h-full">
          <div className="h-full">
            <Sidebar />
          </div>
        </div>
        <div className="bg-background grid h-[calc(100vh-1rem)] relative border rounded-sm border-thin m-2 overflow-hidden border-solid">
          {children}
        </div>
      </main>
    </ThemeProvider>
  );
};
