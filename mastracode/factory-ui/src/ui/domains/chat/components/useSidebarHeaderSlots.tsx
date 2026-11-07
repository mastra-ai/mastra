import { useSidebar } from '@mastra/playground-ui/components/Sidebar';
import type { PageLayoutProps } from '@mastra/playground-ui/components/PageLayout';
import type { ReactNode } from 'react';

import { GlobalSearchButton } from '../../search/components/GlobalSearchButton';
import { ChatHeaderSidebarTrigger } from './ChatHeaderSidebarTrigger';

/**
 * Page header slots with the sidebar trigger in front of the breadcrumbs when the sidebar is out of view:
 * on mobile (where search lives in the drawer) and while the desktop sidebar is collapsed.
 */
export function useSidebarHeaderSlots({
  breadcrumbs,
  headerActions,
}: { breadcrumbs?: ReactNode; headerActions?: ReactNode } = {}): Pick<
  PageLayoutProps,
  'breadcrumbs' | 'headerActions'
> {
  const { isMobile, desktopState } = useSidebar();
  const collapsed = !isMobile && desktopState === 'collapsed';
  const showTrigger = isMobile || collapsed;

  return {
    breadcrumbs:
      showTrigger || breadcrumbs ? (
        <>
          {showTrigger && <ChatHeaderSidebarTrigger />}
          {breadcrumbs}
        </>
      ) : undefined,
    headerActions:
      collapsed || headerActions ? (
        <>
          {headerActions}
          {collapsed && <GlobalSearchButton id="global-search-collapsed-trigger" />}
        </>
      ) : undefined,
  };
}
