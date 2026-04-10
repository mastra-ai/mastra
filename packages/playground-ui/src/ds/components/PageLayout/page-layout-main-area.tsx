import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function PageLayoutMainArea({
  children,
  className,
  isCentered = false,
}: {
  children: ReactNode;
  className?: string;
  isCentered?: boolean;
}) {
  return (
    <div
      className={cn(
        'overflow-auto',
        {
          'flex items-center justify-center': isCentered,
        },
        className,
      )}
    >
      {children}
    </div>
  );
}
