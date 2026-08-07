import type { ReactNode } from 'react';

type PageLayoutProps = {
  sidebar: ReactNode;
  header?: ReactNode;
  children: ReactNode;
};

/** Standard page chrome that participates in native document scrolling. */
export function PageLayout({ sidebar, header, children }: PageLayoutProps) {
  return (
    <div className="bg-surface1 relative z-1 flex min-h-dvh">
      <aside className="sticky top-0 h-dvh min-h-0 shrink-0 overflow-hidden py-2">{sidebar}</aside>
      <div className="border-border1 bg-surface2 relative z-1 flex min-w-0 flex-1 flex-col border-l">
        {header ? <div className="bg-surface2 sticky top-0 z-2 shrink-0">{header}</div> : null}
        {/* isolate — DS pill tabs sit at z-10 and would scroll over the sticky header */}
        <main className="isolate flex min-w-0 flex-1 flex-col p-5">{children}</main>
      </div>
    </div>
  );
}

/** Fixed application viewport for views that own nested scroll regions. */
export function ViewportLayout({ sidebar, header, children }: PageLayoutProps) {
  return (
    <div className="bg-surface1 relative z-1 flex h-dvh overflow-hidden">
      <aside className="h-full min-h-0 shrink-0 overflow-hidden py-2">{sidebar}</aside>
      <div className="border-border1 bg-surface2 relative z-1 flex min-w-0 flex-1 flex-col overflow-hidden border-l">
        {header}
        <main className="isolate flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
