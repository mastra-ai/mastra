import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ReactNode } from 'react';

type PageLayoutProps = {
  sidebar: ReactNode;
  header?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
};

export function PageLayout({ sidebar, header, title, description, children }: PageLayoutProps) {
  const hasHeading = title !== undefined || description !== undefined;

  return (
    <div className="relative z-1 flex h-screen overflow-hidden bg-surface1">
      <aside className="h-full min-h-0 shrink-0 overflow-hidden py-5">{sidebar}</aside>
      <div className="relative z-1 flex min-w-0 flex-1 flex-col overflow-hidden border-l border-border1 bg-surface2">
        {header}
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {hasHeading ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-4 md:px-4 md:py-5">
              <div className="flex min-h-0 w-full flex-1 flex-col gap-4">
                <header className="flex flex-col gap-1">
                  {title !== undefined && <h1 className="m-0 text-xl text-icon6">{title}</h1>}
                  {description !== undefined && (
                    <Txt as="p" variant="ui-sm" className="m-0 text-icon3">
                      {description}
                    </Txt>
                  )}
                </header>
                {children}
              </div>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
