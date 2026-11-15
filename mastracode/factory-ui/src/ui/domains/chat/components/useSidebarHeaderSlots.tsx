import { useSidebar } from '@mastra/playground-ui/components/Sidebar';
import type { PageLayoutProps } from '@mastra/playground-ui/components/PageLayout';
import type { ReactNode } from 'react';

import { ChatHeaderSidebarTrigger } from './ChatHeaderSidebarTrigger';

export function useSidebarHeaderSlots({
  breadcrumbs,
  triggerClassName,
}: { breadcrumbs?: ReactNode; triggerClassName?: string } = {}): Pick<PageLayoutProps, 'breadcrumbs'> {
  const { isMobile, desktopState } = useSidebar();
  const showTrigger = isMobile || desktopState === 'collapsed';

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
