import type { ReactNode } from 'react';
import { ScrollArea, ScrollAreaViewport } from '../ScrollArea';
import type { PageLayoutProps } from './page-layout';
import { PageLayoutCatalogBody } from './page-layout-catalog-body';
import { cn } from '@/lib/utils';

/** Fitted workspaces own their scrolling; document pages share one body viewport. */
export function PageLayoutBody({
  children,
  header,
  variant,
  actionRow,
}: {
  children: ReactNode;
  header: ReactNode;
  variant: NonNullable<PageLayoutProps['variant']>;
  actionRow?: ReactNode;
}) {
  if (variant === 'catalog')
    return (
      <PageLayoutCatalogBody actionRow={actionRow} header={header}>
        {children}
      </PageLayoutCatalogBody>
    );
  if (variant === 'fit')
    return (
      <>
        {header}
        {children}
      </>
    );
  return (
    <ScrollArea className="h-full min-h-0 min-w-0" mask={false}>
      <ScrollAreaViewport className="[&>div]:min-h-full">
        {variant === 'narrow' ? (
          <div
            data-slot="page-layout-container"
            className={cn(
              'mx-auto grid min-h-full w-full max-w-5xl grid-cols-1 p-4',
              header ? 'grid-rows-[auto_1fr]' : 'grid-rows-[1fr]',
            )}
          >
            {header}
            {children}
          </div>
        ) : (
          <>
            {header}
            {children}
          </>
        )}
      </ScrollAreaViewport>
    </ScrollArea>
  );
}
