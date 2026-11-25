import { Txt } from '@mastra/playground-ui/components/Txt';
import { SessionPageFrame } from '@mastra/playground-ui/new/layout/session-page-frame';
import type { ReactNode } from 'react';

import { reservedSpaceClass } from '../../workspace-viewer/layout';
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
    triggerClassName: 'size-control-sm rounded-full [&>svg]:size-icon-md',
  });

  return (
    <SessionPageFrame
      breadcrumbs={slots.breadcrumbs}
      headerCenter={headerCenter}
      headerActions={headerActions}
      headerClassName={reservedSpaceClass.header}
      dockActions={dockActions}
    >
      {children}
    </SessionPageFrame>
  );
}
