import { cn } from '@/lib/utils';
import React from 'react';

type EntryListEdgingProps = {
  children: React.ReactNode;
};

export function EntryListEdging({ children }: EntryListEdgingProps) {
  return <div className={cn('rounded-t-lg border border-border1')}>{children}</div>;
}
