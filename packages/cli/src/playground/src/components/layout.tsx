import React from 'react';

import { AppSidebar } from './ui/app-sidebar';
import { SidebarProvider } from './ui/sidebar';
import { Toaster } from './ui/sonner';
import { ThemeProvider } from './ui/theme-provider';
import { PageLayout, PageHeader, PageHeaderLogo, PageHeaderStars } from '@mastra/playground-ui';

export const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <ThemeProvider defaultTheme="dark" attribute="class">
      <SidebarProvider>
        <PageLayout>
          <PageHeader>
            <PageHeaderLogo variant="playground" /> <PageHeaderStars />
          </PageHeader>
          <AppSidebar />
          {children}
          <Toaster position="bottom-right" />
        </PageLayout>
      </SidebarProvider>
    </ThemeProvider>
  );
};
