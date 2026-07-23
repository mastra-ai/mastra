import type { ReactNode } from 'react';

type PageLayoutProps = {
  sidebar: ReactNode;
  header?: ReactNode;
  children: ReactNode;
};

/** Standard page chrome that participates in native document scrolling. */
export function PageLayout({ sidebar, header, children }: PageLayoutProps) {
  return (
    <div className="relative z-1 flex min-h-dvh bg-surface1">
      <aside className="sticky top-0 h-dvh min-h-0 shrink-0 overflow-hidden py-2">{sidebar}</aside>
      <div className="relative z-1 flex min-w-0 flex-1 flex-col border-l border-border1 bg-surface2">
        {header ? <div className="sticky top-0 z-2 shrink-0 bg-surface2">{header}</div> : null}
        <main className="flex min-w-0 flex-1 flex-col p-5">{children}</main>
      </div>
    </div>
  );
}

/** Fixed application viewport for views that own nested scroll regions. */
export function ViewportLayout({ sidebar, header, children }: PageLayoutProps) {
  return (
    <div className="relative z-1 flex h-dvh overflow-hidden bg-surface1">
      <aside className="h-full min-h-0 shrink-0 overflow-hidden py-2">{sidebar}</aside>
      <div className="relative z-1 flex min-w-0 flex-1 flex-col overflow-hidden border-l border-border1 bg-surface2">
        {header}
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
