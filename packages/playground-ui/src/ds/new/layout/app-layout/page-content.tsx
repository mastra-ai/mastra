import '../../../../../new-theme.css';
import type { ComponentPropsWithRef, ReactNode } from 'react';

import { ScrollArea } from '@/ds/components/ScrollArea';

export interface PageContentProps extends ComponentPropsWithRef<'main'> {
  pageHeader?: ReactNode;
}

export function PageContent({ children, pageHeader, ...props }: PageContentProps) {
  return (
    <ScrollArea
      className="new-theme min-h-0 min-w-0 flex-1 [&_[data-orientation=vertical]]:w-1 [&_[data-orientation=vertical]]:p-0"
      mask={false}
      orientation="both"
      viewportRender={<main role="main" data-slot="page-content" tabIndex={0} {...props} />}
      viewPortClassName="overscroll-contain p-5 text-foreground focus-visible:outline-1 focus-visible:-outline-offset-2 focus-visible:outline-ring"
    >
      {pageHeader && <div className="mb-5">{pageHeader}</div>}
      {children}
    </ScrollArea>
  );
}
