import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export function ActivityReveal({
  id,
  open,
  className,
  children,
}: {
  id: string;
  open: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'grid transition-[grid-template-rows] duration-slow ease-out-custom motion-reduce:transition-none',
        open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
      )}
    >
      <div
        id={id}
        inert={!open}
        className={cn(
          'min-h-0 overflow-hidden transition-opacity duration-slow ease-out-custom motion-reduce:transition-none',
          !open && 'opacity-0',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
