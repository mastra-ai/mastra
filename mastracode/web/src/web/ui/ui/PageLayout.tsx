import type { ReactNode } from 'react';

type PageLayoutProps = {
  sidebar: ReactNode;
  header?: ReactNode;
  children: ReactNode;
};

type PageLayoutMode = 'document' | 'viewport';

type PageLayoutClassNames = {
  root: string;
  sidebar: string;
  surface: string;
  header?: string;
  main: string;
};

const PAGE_LAYOUT_CLASS_NAMES: Record<PageLayoutMode, PageLayoutClassNames> = {
  document: {
    root: 'relative z-1 flex min-h-dvh bg-surface1',
    sidebar: 'sticky top-0 h-dvh min-h-0 shrink-0 overflow-hidden py-2',
    surface: 'relative z-1 flex min-w-0 flex-1 flex-col border-l border-border1 bg-surface2',
    header: 'sticky top-0 z-2 shrink-0 bg-surface2',
    main: 'flex min-w-0 flex-1 flex-col p-5',
  },
  viewport: {
    root: 'relative z-1 flex h-dvh overflow-hidden bg-surface1',
    sidebar: 'h-full min-h-0 shrink-0 overflow-hidden py-2',
    surface: 'relative z-1 flex min-w-0 flex-1 flex-col overflow-hidden border-l border-border1 bg-surface2',
    main: 'flex min-h-0 flex-1 flex-col overflow-hidden',
  },
};

function PageLayoutFrame({
  sidebar,
  header,
  children,
  mode,
}: PageLayoutProps & {
  mode: PageLayoutMode;
}) {
  const classNames = PAGE_LAYOUT_CLASS_NAMES[mode];

  return (
    <div className={classNames.root}>
      <aside className={classNames.sidebar}>{sidebar}</aside>
      <div className={classNames.surface}>
        {header && classNames.header ? <div className={classNames.header}>{header}</div> : header}
        <main className={classNames.main}>{children}</main>
      </div>
    </div>
  );
}

/** Page frame that participates in native document scrolling. */
export function DocumentPageLayout(props: PageLayoutProps) {
  return <PageLayoutFrame {...props} mode="document" />;
}

/** Fixed-viewport frame for views that own nested scroll regions. */
export function ViewportPageLayout(props: PageLayoutProps) {
  return <PageLayoutFrame {...props} mode="viewport" />;
}
