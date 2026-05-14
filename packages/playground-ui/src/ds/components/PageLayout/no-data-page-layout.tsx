import type { ReactNode } from 'react';
import { PageLayout } from './page-layout';

export function NoDataPageLayout({ children }: { title?: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <PageLayout width="wide" height="full" className="grid-rows-[1fr]">
      <PageLayout.MainArea isCentered>{children}</PageLayout.MainArea>
    </PageLayout>
  );
}
