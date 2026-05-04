import type { ReactNode } from 'react';
import { PageHeader } from '../PageHeader';
import { PageLayout } from './page-layout';

export function NoDataPageLayout({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <PageLayout width="wide" height="full">
      <PageLayout.TopArea>
        <PageHeader>
          <PageHeader.Title>
            {icon} {title}
          </PageHeader.Title>
        </PageHeader>
      </PageLayout.TopArea>
      <PageLayout.MainArea isCentered>{children}</PageLayout.MainArea>
    </PageLayout>
  );
}
