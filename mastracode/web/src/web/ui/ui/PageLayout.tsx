import { Txt } from '@mastra/playground-ui/components/Txt';
import { createContext, useContext, type ReactNode } from 'react';

type PageLayoutProps = {
  sidebar: ReactNode;
  header?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  /** Right-aligned controls in the page heading row (e.g. a repository picker). */
  actions?: ReactNode;
  children: ReactNode;
};

type PageLayoutMainViewProviderProps = {
  children: ReactNode;
  view?: ReactNode;
  mobileHeader?: ReactNode;
};

const PageLayoutMainViewContext = createContext<ReactNode | undefined>(undefined);
const PageLayoutMobileHeaderContext = createContext<ReactNode | undefined>(undefined);

export function PageLayoutMainViewProvider({ children, view, mobileHeader }: PageLayoutMainViewProviderProps) {
  return (
    <PageLayoutMainViewContext.Provider value={view}>
      <PageLayoutMobileHeaderContext.Provider value={mobileHeader}>{children}</PageLayoutMobileHeaderContext.Provider>
    </PageLayoutMainViewContext.Provider>
  );
}

export function PageLayoutMobileHeader() {
  return useContext(PageLayoutMobileHeaderContext);
}

export function PageLayout({ sidebar, header, title, description, actions, children }: PageLayoutProps) {
  const hasHeading = title !== undefined || description !== undefined;
  const view = useContext(PageLayoutMainViewContext);
  const mobileHeader = useContext(PageLayoutMobileHeaderContext);
  const resolvedMobileHeader =
    mobileHeader ??
    (title !== undefined ? (
      <Txt as="h1" variant="header-sm" className="min-w-0 flex-1 truncate text-icon6">
        {title}
      </Txt>
    ) : undefined);

  return (
    <div className="relative z-1 flex h-screen overflow-hidden bg-surface1">
      <aside className="h-full min-h-0 shrink-0 overflow-hidden py-2">{sidebar}</aside>
      <div className="relative z-1 flex min-w-0 flex-1 flex-col overflow-hidden bg-surface2">
        <PageLayoutMobileHeaderContext.Provider value={resolvedMobileHeader}>
          {header}
        </PageLayoutMobileHeaderContext.Provider>
        <main
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          hidden={view !== undefined}
          inert={view !== undefined ? true : undefined}
          aria-hidden={view !== undefined ? true : undefined}
        >
          {hasHeading ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-4 md:px-4 md:py-5">
              <div className="flex min-h-0 w-full flex-1 flex-col gap-4">
                <header className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    {title !== undefined && (
                      <Txt as="h1" variant="header-sm" className="hidden text-icon6 md:block">
                        {title}
                      </Txt>
                    )}
                    {description !== undefined && (
                      <Txt as="p" variant="ui-sm" className="m-0 text-icon3">
                        {description}
                      </Txt>
                    )}
                  </div>
                  {actions}
                </header>
                {children}
              </div>
            </div>
          ) : (
            children
          )}
        </main>
        {view !== undefined && <main className="flex min-h-0 flex-1 flex-col overflow-hidden">{view}</main>}
      </div>
    </div>
  );
}
