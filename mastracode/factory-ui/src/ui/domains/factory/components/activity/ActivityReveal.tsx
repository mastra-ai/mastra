import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';

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
        'duration-slow ease-out-custom grid transition-[grid-template-rows] motion-reduce:transition-none',
        open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
      )}
    >
      <div
        id={id}
        inert={!open}
        className={cn(
          'duration-slow ease-out-custom min-h-0 overflow-hidden transition-opacity motion-reduce:transition-none',
          !open && 'opacity-0',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
