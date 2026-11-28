import type { ReactNode } from 'react';

export interface ThreadsCardListProps {
  label?: string;
  children: ReactNode;
}

export function ThreadsCardList({ label = 'Threads', children }: ThreadsCardListProps) {
  return (
    <nav aria-label={label} className="flex min-h-0 flex-1 flex-col">
      <ul className="flex min-h-0 flex-col gap-0.5 overflow-y-auto">{children}</ul>
    </nav>
  );
}
