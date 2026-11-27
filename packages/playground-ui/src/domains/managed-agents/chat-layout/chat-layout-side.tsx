import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function ChatLayoutSide({
  side,
  open,
  children,
}: {
  side: 'start' | 'end';
  open: boolean;
  children: ReactNode;
}) {
  return (
    <div
      data-slot={side === 'start' ? 'chat-layout-threads' : 'chat-layout-details'}
      data-open={open}
      inert={!open || undefined}
      className={cn(
        'shrink-0 overflow-hidden transition-[width] duration-slow ease-in-out-custom motion-reduce:transition-none',
        open ? (side === 'start' ? 'w-67' : 'w-77') : 'w-0',
      )}
    >
      <div
        className={cn(
          'flex h-full transition-[translate,opacity] duration-slow ease-in-out-custom motion-reduce:transition-none',
          side === 'start' ? 'w-67 pr-2' : 'w-77 pl-2',
          open
            ? 'translate-x-0 opacity-100'
            : side === 'start'
              ? '-translate-x-4 opacity-0'
              : 'translate-x-4 opacity-0',
        )}
      >
        {children}
      </div>
    </div>
  );
}
