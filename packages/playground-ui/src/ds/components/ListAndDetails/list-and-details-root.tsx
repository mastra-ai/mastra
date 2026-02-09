import React from 'react';
import { cn } from '@/lib/utils';
import { transitions } from '@/ds/primitives/transitions';

export type ListAndDetailsRootProps = {
  children: React.ReactNode;
  isDetailsActive?: boolean;
  isSecondDetailsActive?: boolean; // for future use when we have 3 columns
  className?: string;
};

export function ListAndDetailsRoot({
  children,
  isDetailsActive = false,
  isSecondDetailsActive = false,
  className,
}: ListAndDetailsRootProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'grid h-full overflow-hidden',
        transitions.allSlow,
        {
          'grid-cols-1': !isDetailsActive,
          'grid-cols-[auto_1fr]': isDetailsActive,
          // 'grid-cols-1': !isDetailsActive && !isSecondDetailsActive,
          // 'grid-cols-[auto_1px_1fr]': isDetailsActive && !isSecondDetailsActive,
          // 'grid-cols-[auto_1px_1fr_1px_1fr]': isDetailsActive && isSecondDetailsActive,
        },
        className,
      )}
      //. style={{ border: '2px solid green' }}
    >
      {children}
    </div>
  );
}
