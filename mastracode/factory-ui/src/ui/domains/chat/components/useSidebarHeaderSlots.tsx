import { useSidebar } from '@mastra/playground-ui/components/Sidebar';
import type { PageLayoutPageProps } from '@mastra/playground-ui/components/PageLayout';
import type { ReactNode } from 'react';

import { ChatHeaderSidebarTrigger } from './ChatHeaderSidebarTrigger';

/**
 * Page header slots for while the desktop sidebar is collapsed: the sidebar trigger goes in front of the breadcrumbs.
 * On mobile the app's header holds the trigger.
 */
export function useSidebarHeaderSlots({
  breadcrumbs,
  triggerClassName,
}: { breadcrumbs?: ReactNode; triggerClassName?: string } = {}): Pick<PageLayoutPageProps, 'breadcrumbs'> {
  const { isMobile, desktopState } = useSidebar();
  const showTrigger = !isMobile && desktopState === 'collapsed';

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
