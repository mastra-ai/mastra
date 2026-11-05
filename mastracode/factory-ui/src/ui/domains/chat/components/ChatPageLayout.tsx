import { Breadcrumb } from '@mastra/playground-ui/components/Breadcrumb';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import type { ReactNode } from 'react';

import { useSidebarHeaderSlots } from './useSidebarHeaderSlots';

interface ChatPageLayoutProps {
  crumbs?: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
}

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
