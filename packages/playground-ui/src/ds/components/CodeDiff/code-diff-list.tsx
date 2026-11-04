'use client';

import { Virtualizer } from '@pierre/diffs/react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface CodeDiffListProps {
  children: ReactNode;
  className?: string;
}

/** Stacks `CodeDiff`s edge to edge like a pull request, rendering only the lines in view so long change sets stay fast. */
export function CodeDiffList({ children, className }: CodeDiffListProps) {
  return (
    <Virtualizer
      className={cn('min-h-0 overflow-auto', className)}
      contentClassName="flex flex-col *:rounded-none *:border-x-0 *:border-t-0"
    >
      {children}
    </Virtualizer>
  );
}
