import React from 'react';
import { cn } from '@/lib/utils';

export interface PageHeaderRootProps {
  children?: React.ReactNode;
  className?: string;
}

export function PageHeaderRoot({ children, className }: PageHeaderRootProps) {
  return (
    <header
      className={cn(
        'w-full grid',
        className,
      )}
    >
      {children}
    </header>
  );
}
