import { Breadcrumb } from '@mastra/playground-ui/components/Breadcrumb';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import type { ReactNode } from 'react';

import { useSidebarHeaderSlots } from './useSidebarHeaderSlots';

interface ChatPageLayoutProps {
  /** `Crumb` elements; the last one is the current page. */
  crumbs?: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
}

/** `PageLayout` for chat pages (new session, thread, supervisor) with a crumb trail. */
export function ChatPageLayout({ crumbs, headerActions, children }: ChatPageLayoutProps) {
  const slots = useSidebarHeaderSlots({
    breadcrumbs: crumbs && (
      <Breadcrumb label="Breadcrumb" className="min-w-0 flex-1 overflow-hidden" listClassName="min-w-0">
        {crumbs}
      </Breadcrumb>
    ),
    headerActions,
  });

  return (
    <PageLayout variant="fit" {...slots}>
      {children}
    </PageLayout>
  );
}
