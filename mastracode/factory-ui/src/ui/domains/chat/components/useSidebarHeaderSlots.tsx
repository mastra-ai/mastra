import { useMainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import type { PageLayoutProps } from '@mastra/playground-ui/components/PageLayout';
import type { ReactNode } from 'react';

import { GlobalSearchButton } from '../../search/components/GlobalSearchButton';
import { ChatHeaderSidebarTrigger } from './ChatHeaderSidebarTrigger';

/**
 * `PageLayout` header slots that carry the sidebar trigger and global search while the
 * desktop sidebar is collapsed (on mobile `AppLayout` owns both).
 */
export function useSidebarHeaderSlots({
  breadcrumbs,
  headerActions,
}: { breadcrumbs?: ReactNode; headerActions?: ReactNode } = {}): Pick<
  PageLayoutProps,
  'breadcrumbs' | 'headerActions'
> {
  const { isMobile, desktopState } = useMainSidebar();
  const collapsed = !isMobile && desktopState === 'collapsed';

  return {
    breadcrumbs:
      collapsed || breadcrumbs ? (
        <>
          {collapsed && <ChatHeaderSidebarTrigger />}
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
