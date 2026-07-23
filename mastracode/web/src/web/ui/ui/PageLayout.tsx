import type { ReactNode } from 'react';

type PageLayoutProps = {
  sidebar: ReactNode;
  header?: ReactNode;
  /** Right-aligned controls in the page heading row (e.g. a repository picker). */
  actions?: ReactNode;
  children: ReactNode;
};

export function PageLayout({ sidebar, header, actions, children }: PageLayoutProps) {
  return (
    <div className="relative z-1 flex h-screen overflow-hidden bg-surface1">
      <aside className="h-full min-h-0 shrink-0 overflow-hidden py-2">{sidebar}</aside>
      <div className="relative z-1 flex min-w-0 flex-1 flex-col overflow-hidden border-l border-border1 bg-surface2">
        {header}
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-5">{children}</main>
      </div>
    </div>
  );
}
