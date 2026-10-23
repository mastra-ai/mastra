import { useSidebar } from '@mastra/playground-ui/components/Sidebar';
import type { PageLayoutProps } from '@mastra/playground-ui/components/PageLayout';
import type { ReactNode } from 'react';

import { ChatHeaderSidebarTrigger } from './ChatHeaderSidebarTrigger';

/** `PageLayout` breadcrumbs that carry the sidebar trigger while the desktop sidebar is collapsed (on mobile `AppLayout` owns it). */
export function useSidebarHeaderSlots({ breadcrumbs }: { breadcrumbs?: ReactNode } = {}): Pick<
  PageLayoutProps,
  'breadcrumbs'
> {
  const { isMobile, desktopState } = useSidebar();
  const collapsed = !isMobile && desktopState === 'collapsed';

  return {
    breadcrumbs:
      collapsed || breadcrumbs ? (
        <>
          {collapsed && <ChatHeaderSidebarTrigger />}
          {breadcrumbs}
        </>
      ) : undefined,
  };
}
