import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type PageLayoutMainAreaProps = {
  children: ReactNode;
  className?: string;
  isCentered?: boolean;
};

export function PageLayoutMainArea({ children, className, isCentered = false }: PageLayoutMainAreaProps) {
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
