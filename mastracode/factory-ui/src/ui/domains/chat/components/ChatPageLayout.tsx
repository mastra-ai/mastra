import { Header } from '@mastra/playground-ui/components/Header';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';

import { reservedSpaceClass } from '../../workspace-viewer/layout';
import { chatHeaderStyle, headerCapsuleClass } from './chatPageHeader';
import { useSidebarHeaderSlots } from './useSidebarHeaderSlots';

interface ChatPageLayoutProps {
  title?: ReactNode;
  titleMenu?: ReactNode;
  headerCenter?: ReactNode;
  headerActions?: ReactNode;
  dockActions?: (actions: ReactNode) => ReactNode;
  children: ReactNode;
}

export function ChatPageLayout({
  title,
  titleMenu,
  headerCenter,
  headerActions,
  dockActions,
  children,
}: ChatPageLayoutProps) {
  const slots = useSidebarHeaderSlots({
    breadcrumbs: title ? (
      <div className="h-control-sm flex min-w-0 items-center gap-0.5">
        <Txt as="h1" variant="label" tone="ink" className="min-w-0 truncate px-3">
          {title}
        </Txt>
        {titleMenu}
      </div>
    ) : undefined,
    triggerClassName: 'size-control-sm rounded-full [&>svg]:size-4',
  });
  const hasHeader = Boolean(slots.breadcrumbs || headerActions);
  const dock = headerActions && dockActions ? dockActions(headerActions) : undefined;

  return (
    <div className="relative flex h-full min-h-0 flex-col" style={hasHeader ? chatHeaderStyle : undefined}>
      {hasHeader ? (
        // Spans the page, unpadded: the docked card sizes itself in this layer's `cq` units.
        <div className="[container-type:size] pointer-events-none absolute inset-0 z-20">
          <div
            data-slot="chat-page-header"
            className={cn(
              'grid items-center gap-x-2 ps-3 pt-(--chat-header-top)',
              reservedSpaceClass.header,
              // Equal side tracks keep the center on the row's midline, whatever the title holds.
              headerCenter ? 'grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]' : 'grid-cols-[minmax(0,1fr)_auto]',
            )}
          >
            <Header border={false} className={cn('grid grid-cols-subgrid px-0', dock ? 'col-[1/-2]' : 'col-span-full')}>
              {/* One shape with or without the center, so the actions keep their state when the stage bar arrives. */}
              <div className="flex min-w-0 items-center">
                {slots.breadcrumbs && <div className={headerCapsuleClass}>{slots.breadcrumbs}</div>}
              </div>
              {headerCenter ? <div className="flex items-center">{headerCenter}</div> : null}
              {dock ? null : (
                <div className="flex min-w-0 justify-end">
                  {headerActions && <div className={cn(headerCapsuleClass, 'shrink-0')}>{headerActions}</div>}
                </div>
              )}
            </Header>
            {dock}
          </div>
        </div>
      ) : null}
      <PageLayout variant="fit">{children}</PageLayout>
    </div>
  );
}
