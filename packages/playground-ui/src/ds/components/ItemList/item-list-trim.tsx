import { cn } from '@/lib/utils';
import React from 'react';

export type ItemListTrimProps = {
  children: React.ReactNode;
};

export function ItemListTrim({ children }: ItemListTrimProps) {
  return <div className={cn('overflow-clip')}>{children}</div>;
}
