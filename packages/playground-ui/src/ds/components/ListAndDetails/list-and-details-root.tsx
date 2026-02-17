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
        'LAD-ROOT grid h-full overflow-hidden',
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
