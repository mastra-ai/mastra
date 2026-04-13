import type { ReactNode } from 'react';
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
  return (
    <main
      className={cn(
        'w-full h-full grid grid-rows-[auto_auto] px-10 mx-auto pb-6 content-start overflow-y-auto',
        {
          'max-w-[110rem]': width === 'default',
          'max-w-[55rem]': width === 'narrow',
          'grid-rows-[auto_1fr]': height === 'full',
        },
        className,
        //   'LAYOUT_ROOT border border-dashed border-orange-400',
      )}
    >
      {children}
    </main>
  );
}
