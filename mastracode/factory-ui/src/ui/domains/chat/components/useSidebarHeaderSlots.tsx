import { useSidebar } from '@mastra/playground-ui/components/Sidebar';
import type { PageLayoutProps } from '@mastra/playground-ui/components/PageLayout';
import type { ReactNode } from 'react';

import { GlobalSearchButton } from '../../search/components/GlobalSearchButton';
import { ChatHeaderSidebarTrigger } from './ChatHeaderSidebarTrigger';

/**
 * Page header slots for when the sidebar is out of view (on mobile and while the desktop sidebar is collapsed):
 * the sidebar trigger goes in front of the breadcrumbs and search goes last among the header actions.
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
      showTrigger || headerActions ? (
        <>
          {headerActions}
          {showTrigger && (
            <GlobalSearchButton id={isMobile ? 'global-search-mobile-trigger' : 'global-search-collapsed-trigger'} />
          )}
        </>
      ) : undefined,
  };
}
