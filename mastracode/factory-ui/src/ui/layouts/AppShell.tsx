import type { ReactNode } from 'react';

import { cn } from '@mastra/playground-ui/utils/cn';

export type AppShellProps = {
  sidebar: ReactNode;
  header?: ReactNode;
  children: ReactNode;
  /**
   * Who owns the scrolling. `document` lets the page scroll natively; `viewport`
   * pins the frame to the viewport so the content can own nested scroll regions.
   * The shell itself never scrolls and never clips in either mode.
   */
  scroll: 'document' | 'viewport';
};

const HEADER_HEIGHT_CLASS = '[--page-header-height:3.5rem] lg:[--page-header-height:2.75rem]';
const STICKY_TOP_CLASS =
  '[--page-sticky-top:0rem] has-[>[data-page-header]:not(:empty)]:[--page-sticky-top:var(--page-header-height)]';

/** Application frame — sidebar, optional header, content — shared by every app page. */
export function AppShell({ sidebar, header, children, scroll }: AppShellProps) {
  const documentScroll = scroll === 'document';
  const stickyHeader = header ? (
    <div data-page-header className="bg-surface2 sticky top-0 z-2 shrink-0">
      {header}
    </div>
  ) : null;

  return (
    <div className={cn('bg-surface1 relative z-1 flex', documentScroll ? 'min-h-dvh' : 'h-dvh')}>
      <aside className={cn('min-h-0 shrink-0 py-2', documentScroll ? 'sticky top-0 h-dvh' : 'h-full')}>{sidebar}</aside>
      <div
        className={cn(
          HEADER_HEIGHT_CLASS,
          'border-border1 bg-surface2 relative z-1 flex min-w-0 flex-1 flex-col border-l',
          documentScroll && STICKY_TOP_CLASS,
        )}
      >
        {documentScroll ? stickyHeader : header}
        {/* isolate — DS pill tabs sit at z-10 and would scroll over the sticky header */}
        <main className={cn('isolate flex min-w-0 flex-1 flex-col', documentScroll ? 'p-5' : 'min-h-0')}>
          {children}
        </main>
      </div>
    </div>
  );
}
