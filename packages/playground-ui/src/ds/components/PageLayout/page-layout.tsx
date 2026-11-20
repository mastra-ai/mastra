import type { ReactNode } from 'react';
import { Header } from '../Header';
import { ScrollArea, ScrollAreaViewport } from '../ScrollArea';
import { cn } from '@/lib/utils';

export interface PageLayoutProps {
  children: ReactNode;
  /** Left side of the page header row. */
  breadcrumbs?: ReactNode;
  /** Right side of the page header row. */
  headerActions?: ReactNode;
  /** Controls pinned between the header and the scrollable body (search, filters, toggles…). */
  actionRow?: ReactNode;
  /** Page-level header (e.g. `PageHeader`) rendered inside the body container, above children. */
  header?: ReactNode;
}

const bodyContent =
  'mx-auto w-full max-w-(--breakpoint-2xl) has-[>[data-slot=page-layout-workspace]]:grid has-[>[data-slot=page-layout-workspace]]:h-full has-[>[data-slot=page-layout-workspace]]:min-h-0 has-[>[data-slot=page-layout-workspace]]:max-w-none has-[>[data-slot=page-layout-workspace]]:grid-cols-1';

const bodyWithHeader =
  'flex h-full min-h-min flex-col has-[>[data-slot=page-layout-workspace]]:grid-rows-[auto_minmax(0,1fr)] [&:has(>[data-slot=page-layout-workspace])>[data-slot=page-layout-header]]:p-4 [&>:last-child:is([data-slot=empty-state-fill],[data-slot=spinner-fill],.h-full,:has(>[data-slot=empty-state-fill]),:has(>[data-slot=spinner-fill]))]:grow [&>:last-child:is([data-slot=empty-state-fill],[data-slot=spinner-fill],.h-full,:has(>[data-slot=empty-state-fill]),:has(>[data-slot=spinner-fill]))]:basis-0';

const bodyWithoutHeader = 'h-full min-h-min has-[>[data-slot=page-layout-workspace]]:grid-rows-1';

export function PageLayout({ children, breadcrumbs, headerActions, actionRow, header }: PageLayoutProps) {
  return (
    <div data-slot="page-layout" className="flex h-full min-h-0 flex-col">
      {(breadcrumbs || headerActions) && (
        <Header className="min-h-header-default shrink-0 gap-2 overflow-hidden px-2">
          {breadcrumbs}
          {headerActions && (
            <div className="ml-auto flex shrink-0 items-center gap-2 overflow-hidden">{headerActions}</div>
          )}
        </Header>
      )}
      {actionRow && (
        <div data-slot="page-layout-action-row" className="shrink-0 px-4 pt-4">
          <div className="mx-auto flex w-full max-w-(--breakpoint-2xl) flex-col gap-2">{actionRow}</div>
        </div>
      )}
      <main className="flex min-h-0 flex-1 flex-col">
        <ScrollArea className="min-h-0 flex-1">
          <ScrollAreaViewport
            className="p-4 has-[>*>[data-slot=page-layout-workspace]]:p-0"
            contentClassName={cn(bodyContent, header ? bodyWithHeader : bodyWithoutHeader)}
          >
            {header && <div data-slot="page-layout-header">{header}</div>}
            {children}
          </ScrollAreaViewport>
        </ScrollArea>
      </main>
    </div>
  );
}

function PageLayoutWorkspace({ children }: { children: ReactNode }) {
  return (
    <div data-slot="page-layout-workspace" className="grid min-h-0 min-w-0 grid-cols-1 grid-rows-1">
      {children}
    </div>
  );
}

function PageLayoutGrid({ children }: { children: ReactNode }) {
  return (
    <div data-slot="page-layout-grid" className="@container min-w-0">
      <div className="grid grid-cols-1 gap-6 @max-4xl:*:col-span-full! @4xl:grid-cols-12 [:where(&)>*]:col-span-full">
        {children}
      </div>
    </div>
  );
}

PageLayout.Workspace = PageLayoutWorkspace;
PageLayout.Grid = PageLayoutGrid;
