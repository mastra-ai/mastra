import type { ReactNode } from 'react';
import { usePageHeading } from '../PageLayout/page-heading-context';
import { cn } from '@/lib/utils';

export function EntityListPageLayoutRoot({ children, className }: { children: ReactNode; className?: string }) {
  const pageHeading = usePageHeading();

  return (
    <main
      className={cn(
        'w-full h-full overflow-hidden grid grid-rows-[auto_auto] max-w-[110rem] px-10 mx-auto gap-4 py-6 content-start',
        className,
      )}
    >
      {pageHeading && <h1 className="sr-only">{pageHeading}</h1>}
      {children}
    </main>
  );
}
