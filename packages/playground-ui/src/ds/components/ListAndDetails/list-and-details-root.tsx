import React from 'react';
import { cn } from '@/lib/utils';
import { transitions } from '@/ds/primitives/transitions';

export type ListAndDetailsRootProps = {
  children: React.ReactNode;
  isDetailsActive?: boolean;
  className?: string;
};

export function ListAndDetailsRoot({
  children,
  isDetailsActive = false,
  className,
}: ListAndDetailsRootProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'grid h-full overflow-hidden gap-[2vw]',
        transitions.allSlow,
        isDetailsActive ? 'grid-cols-[1fr_1px_auto]' : 'grid-cols-1',
        className,
      )}
    >
      {children}
    </div>
  );
}
