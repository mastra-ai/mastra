import type { ReactNode } from 'react';

type PageLayoutProps = {
  sidebar: ReactNode;
  header?: ReactNode;
  children: ReactNode;
};
const PAGE_HEADER_HEIGHT_CLASS = '[--page-header-height:3.5rem] lg:[--page-header-height:2.75rem]';

/** Standard page chrome that participates in native document scrolling. */
export function PageLayout({ sidebar, header, children }: PageLayoutProps) {
  return (
    <div className="bg-surface1 relative z-1 flex min-h-dvh">
      <aside className="sticky top-0 h-dvh min-h-0 shrink-0 py-2">{sidebar}</aside>
      <div
        className={`${PAGE_HEADER_HEIGHT_CLASS} border-border1 bg-surface2 relative z-1 flex min-w-0 flex-1 flex-col border-l [--page-sticky-top:0rem] has-[>[data-page-header]:not(:empty)]:[--page-sticky-top:var(--page-header-height)]`}
      >
        {header ? (
          <div data-page-header className="bg-surface2 sticky top-0 z-2 shrink-0">
            {header}
          </div>
        ) : null}
        {/* isolate — DS pill tabs sit at z-10 and would scroll over the sticky header */}
        <main className="isolate flex min-w-0 flex-1 flex-col p-5">{children}</main>
      </div>
    </div>
  );
}

/** Fixed application viewport for views that own nested scroll regions. */
export function ViewportLayout({ sidebar, header, children }: PageLayoutProps) {
  return (
    <div className="bg-surface1 relative z-1 flex h-dvh">
      <aside className="h-full min-h-0 shrink-0 py-2">{sidebar}</aside>
      <div
        className={`${PAGE_HEADER_HEIGHT_CLASS} border-border1 bg-surface2 relative z-1 flex min-w-0 flex-1 flex-col border-l`}
      >
        {header}
        <main className="isolate flex min-h-0 flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
