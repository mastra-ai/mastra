import type { ReactNode } from 'react';
import { Txt } from '@/ds/components/Txt';

export interface ThreadsCardProps {
  action?: ReactNode;
  search?: ReactNode;
  children: ReactNode;
}

export function ThreadsCardRoot({ action, search, children }: ThreadsCardProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 p-2">
      <div className="flex min-h-7 items-center justify-between pl-1.5">
        <Txt as="h2" variant="label" tone="ink">
          Threads
        </Txt>
        {action}
      </div>
      {search ? <div className="shrink-0">{search}</div> : null}
      {children}
    </div>
  );
}
