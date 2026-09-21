import type { ReactNode } from 'react';
import { PageLayoutBase } from './page-layout';
import type { PageLayoutProps } from './page-layout';
import { PageLayoutMainArea } from './page-layout-main-area';

export interface NoDataPageLayoutProps extends Pick<PageLayoutProps, 'breadcrumbs' | 'actions'> {
  title?: string;
  icon?: ReactNode;
  children: ReactNode;
}

export function NoDataPageLayout({ children, breadcrumbs, actions }: NoDataPageLayoutProps) {
  return (
    <PageLayoutBase className="grid grid-rows-[1fr] p-4" breadcrumbs={breadcrumbs} actions={actions}>
      <PageLayoutMainArea isCentered>{children}</PageLayoutMainArea>
    </PageLayoutBase>
  );
}
