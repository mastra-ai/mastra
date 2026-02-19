import { cn } from '@/lib/utils';
import React from 'react';

export type ItemListRootProps = {
  children: React.ReactNode;
  className?: string;
};

export function ItemListRoot({ children, className }: ItemListRootProps) {
  return <div className={cn('grid grid-rows-[auto_1fr] overflow-y-auto', className)}>{children}</div>;
}
