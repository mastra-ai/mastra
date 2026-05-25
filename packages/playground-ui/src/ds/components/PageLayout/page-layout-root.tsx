import type { ReactNode } from 'react';
import { usePageHeading } from './page-heading-context';
import { cn } from '@/lib/utils';

export function PageLayoutRoot({
  children,
  className,
  width = 'default',
  height = 'default',
}: {
  children: ReactNode;
  className?: string;
  width?: 'default' | 'narrow' | 'wide';
  height?: 'default' | 'full';
}) {
  const pageHeading = usePageHeading();

  return (
    <main
      className={cn(
        'w-full grid grid-rows-[auto_auto] p-6 content-start',
        {
          'max-w-screen-lg mx-auto pt-8': width === 'narrow',
          'h-full grid-rows-[auto_1fr] overflow-y-auto': height === 'full',
        },
        className,
        //   'LAYOUT_ROOT border border-dashed border-orange-400',
      )}
    >
      {pageHeading && <h1 className="sr-only">{pageHeading}</h1>}
      {children}
    </main>
  );
}
