import { Header } from '@mastra/playground-ui/components/Header';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';

import { useSidebarHeaderSlots } from './useSidebarHeaderSlots';

interface ChatPageLayoutProps {
  /** What the page shows, as the header's heading. The sidebar already gives the way back, so there is no trail. */
  title?: ReactNode;
  /** A control right after the title, such as a switcher between sibling sessions. */
  titleMenu?: ReactNode;
  /** Sits between the title and the actions, centered on the header; the title truncates before reaching it. */
  headerCenter?: ReactNode;
  headerActions?: ReactNode;
  /** Floats over the page's top-right corner, beside the header rather than under it: the docked session panel. */
  aside?: ReactNode;
  children: ReactNode;
}

export function ChatPageLayout({
  title,
  titleMenu,
  headerCenter,
  headerActions,
  aside,
  children,
}: ChatPageLayoutProps) {
  const slots = useSidebarHeaderSlots({
    breadcrumbs: title ? (
      <div className="flex min-w-0 items-center gap-0.5">
        <Txt as="h1" variant="label" tone="ink" className="min-w-0 truncate px-3">
          {title}
        </Txt>
        {titleMenu}
      </div>
    ) : undefined,
    headerActions,
  });
  const actions = slots.headerActions && (
    <div className="ml-auto flex shrink-0 items-center gap-2 overflow-hidden">{slots.headerActions}</div>
  );

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {slots.breadcrumbs || actions ? (
        // No rule underneath: the header is the conversation's top row. A docked panel sets
        // `--workspace-files-header-inset`, so the row ends beside the panel instead of running under it.
        <div
          data-slot="chat-page-header"
          className="shrink-0 pe-(--workspace-files-header-inset) transition-[var(--workspace-files-transition,padding)]"
        >
          <Header
            border={false}
            className={cn(
              'min-h-header-default overflow-hidden',
              // Equal side tracks keep the center on the row's midline, whatever the title holds.
              headerCenter && '@container grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]',
            )}
          >
            {/* One shape with or without the center, so controls in the actions keep their state when the stage bar arrives. */}
            <div className="flex min-w-0 flex-1 items-center gap-2">{slots.breadcrumbs}</div>
            {headerCenter ? <div className="flex items-center">{headerCenter}</div> : null}
            <div className="flex min-w-0 justify-end">{actions}</div>
          </Header>
        </div>
      ) : null}
      <PageLayout variant="fit">{children}</PageLayout>
      {aside}
    </div>
  );
}
