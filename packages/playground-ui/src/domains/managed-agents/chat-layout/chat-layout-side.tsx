import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

function sideWidth(side: 'start' | 'end', open: boolean) {
  if (!open) return 'w-0';
  if (side === 'start') return 'w-67';
  return 'w-77';
}

function sideMotion(side: 'start' | 'end', open: boolean) {
  if (open) return 'translate-x-0 opacity-100';
  if (side === 'start') return '-translate-x-4 opacity-0';
  return 'translate-x-4 opacity-0';
}

export function ChatLayoutSide({
  side,
  open,
  children,
}: {
  side: 'start' | 'end';
  open: boolean;
  children: ReactNode;
}) {
  const widthClasses = sideWidth(side, open);
  const motionClasses = sideMotion(side, open);
  return (
    <div
      data-slot={side === 'start' ? 'chat-layout-threads' : 'chat-layout-details'}
      data-open={open}
      inert={!open || undefined}
      className={cn(
        'shrink-0 overflow-hidden transition-[width] duration-slow ease-in-out-custom motion-reduce:transition-none',
        widthClasses,
      )}
    >
      <div
        className={cn(
          'flex h-full transition-[translate,opacity] duration-slow ease-in-out-custom motion-reduce:transition-none',
          side === 'start' ? 'w-67 pr-2' : 'w-77 pl-2',
          motionClasses,
        )}
      >
        {children}
      </div>
    </div>
  );
}
