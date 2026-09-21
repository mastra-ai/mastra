import type { ReactNode } from 'react';
import { PageLayout } from './page-layout';
import type { PageLayoutRootProps } from './page-layout-root';

export interface NoDataPageLayoutProps extends Pick<PageLayoutRootProps, 'breadcrumbs' | 'actions' | 'heading'> {
  title?: string;
  icon?: ReactNode;
  children: ReactNode;
}

export function NoDataPageLayout({ children, breadcrumbs, actions, heading }: NoDataPageLayoutProps) {
  return (
    <PageLayout
      width="wide"
      height="full"
      className="grid-rows-[1fr]"
      breadcrumbs={breadcrumbs}
      actions={actions}
      heading={heading}
    >
      <PageLayout.MainArea isCentered>{children}</PageLayout.MainArea>
    </PageLayout>
  );
}
