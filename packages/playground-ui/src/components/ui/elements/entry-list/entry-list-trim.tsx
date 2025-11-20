import { cn } from '@/lib/utils';
import React from 'react';

type EntryListTrimProps = {
  children: React.ReactNode;
};

export function EntryListTrim({ children }: EntryListTrimProps) {
  return <div className={cn('rounded-lg border border-border1 overflow-clip')}>{children}</div>;
}
