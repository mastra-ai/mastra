import type { ReactNode } from 'react';

import { headerStyle, sessionHeaderCapsuleClass } from './session-header-style';
import { Header } from '@/ds/components/Header';
import { PageLayout } from '@/ds/components/PageLayout';
import { cn } from '@/lib/utils';

interface SessionPageFrameProps {
  breadcrumbs?: ReactNode;
  headerCenter?: ReactNode;
  headerActions?: ReactNode;
  headerClassName?: string;
  dockActions?: (actions: ReactNode) => ReactNode;
  children: ReactNode;
}

export function SessionPageFrame({
  breadcrumbs,
  headerCenter,
  headerActions,
  headerClassName,
  dockActions,
  children,
}: SessionPageFrameProps) {
  const hasHeader = Boolean(breadcrumbs || headerActions);
  const dock = headerActions && dockActions ? dockActions(headerActions) : undefined;

  return (
    <div className="relative flex h-full min-h-0 flex-col" style={hasHeader ? headerStyle : undefined}>
      {hasHeader ? (
        // Spans the page, unpadded: the docked card sizes itself in this layer's `cq` units.
        <div className="[container-type:size] pointer-events-none absolute inset-0 z-20">
          <div
            data-slot="chat-page-header"
            className={cn(
              'grid items-center gap-x-2 ps-3 pt-(--chat-header-top)',
              // Equal side tracks keep the center on the row's midline, whatever the title holds.
              headerCenter ? 'grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]' : 'grid-cols-[minmax(0,1fr)_auto]',
              headerClassName,
            )}
          >
            <Header border={false} className={cn('grid grid-cols-subgrid px-0', dock ? 'col-[1/-2]' : 'col-span-full')}>
              {/* One shape with or without the center, so the actions keep their state when the stage bar arrives. */}
              <div className="flex min-w-0 items-center">
                {breadcrumbs && <div className={sessionHeaderCapsuleClass}>{breadcrumbs}</div>}
              </div>
              {headerCenter ? <div className="flex items-center">{headerCenter}</div> : null}
              {dock ? null : (
                <div className="flex min-w-0 justify-end">
                  {headerActions && <div className={cn(sessionHeaderCapsuleClass, 'shrink-0')}>{headerActions}</div>}
                </div>
              )}
            </Header>
            {dock}
          </div>
        </div>
      ) : null}
      <PageLayout variant="page" body="fixed">
        {children}
      </PageLayout>
    </div>
  );
}
