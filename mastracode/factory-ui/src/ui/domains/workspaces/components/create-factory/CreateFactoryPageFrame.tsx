import { PageHeader } from '@mastra/playground-ui/components/PageHeader';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import type { ReactNode } from 'react';

import { useSidebarHeaderSlots } from '../../../chat/components/useSidebarHeaderSlots';

export function CreateFactoryPageFrame({ children }: { children: ReactNode }) {
  const slots = useSidebarHeaderSlots();
  return (
    <PageLayout
      {...slots}
      variant="narrow"
      header={
        <PageHeader>
          <PageHeader.Title>New Factory</PageHeader.Title>
        </PageHeader>
      }
    >
      {children}
    </PageLayout>
  );
}
