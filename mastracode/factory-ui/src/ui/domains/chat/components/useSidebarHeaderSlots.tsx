import { useSidebar } from '@mastra/playground-ui/components/Sidebar';
import type { PageLayoutProps } from '@mastra/playground-ui/components/PageLayout';
import type { ReactNode } from 'react';

import { ChatHeaderSidebarTrigger } from './ChatHeaderSidebarTrigger';

/**
 * Page header slots for when the sidebar is out of view (on mobile and while the desktop sidebar is collapsed):
 * the sidebar trigger goes in front of the breadcrumbs.
 */
export function useSidebarHeaderSlots({
  breadcrumbs,
  triggerClassName,
}: { breadcrumbs?: ReactNode; triggerClassName?: string } = {}): Pick<PageLayoutProps, 'breadcrumbs'> {
  const { isMobile, desktopState } = useSidebar();
  const collapsed = !isMobile && desktopState === 'collapsed';
  const showTrigger = isMobile || collapsed;

  return {
    breadcrumbs:
      showTrigger || breadcrumbs ? (
        <>
          {showTrigger && <ChatHeaderSidebarTrigger className={triggerClassName} />}
          {breadcrumbs}
        </>
      ) : undefined,
  };
}
