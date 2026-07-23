import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';

type PageLayoutProps = {
  sidebar: ReactNode;
  header?: ReactNode;
  /** Right-aligned controls in the page heading row (e.g. a repository picker). */
  actions?: ReactNode;
  /** Whether the shell owns a fixed viewport or participates in document scrolling. */
  scrollMode?: 'viewport' | 'document';
  children: ReactNode;
};

export function PageLayout({ sidebar, header, scrollMode = 'viewport', children }: PageLayoutProps) {
  const documentScroll = scrollMode === 'document';

  return (
    <div className={cn('relative z-1 flex bg-surface1', documentScroll ? 'min-h-dvh' : 'h-screen overflow-hidden')}>
      <aside className={cn('min-h-0 shrink-0 overflow-hidden py-2', documentScroll ? 'sticky top-0 h-dvh' : 'h-full')}>
        {sidebar}
      </aside>
      <div
        className={cn(
          'relative z-1 flex min-w-0 flex-1 flex-col border-l border-border1 bg-surface2',
          !documentScroll && 'overflow-hidden',
        )}
      >
        {header && (documentScroll ? <div className="sticky top-0 z-2 shrink-0 bg-surface2">{header}</div> : header)}
        <main className={cn('flex flex-1 flex-col p-5', documentScroll ? 'min-w-0' : 'min-h-0 overflow-hidden')}>
          {children}
        </main>
      </div>
    </div>
  );
}
