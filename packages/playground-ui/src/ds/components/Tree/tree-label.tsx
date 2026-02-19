import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TreeLabelProps {
  className?: string;
  children: React.ReactNode;
}

export const TreeLabel = React.forwardRef<HTMLSpanElement, TreeLabelProps>(({ className, children }, ref) => (
  <span ref={ref} className={cn('truncate text-neutral5', className)}>
    {children}
  </span>
));
TreeLabel.displayName = 'Tree.Label';
