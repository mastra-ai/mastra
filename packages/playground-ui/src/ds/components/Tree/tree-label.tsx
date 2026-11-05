import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TreeLabelProps extends React.HTMLAttributes<HTMLSpanElement> {
  className?: string;
  children: React.ReactNode;
}

export const TreeLabel = React.forwardRef<HTMLSpanElement, TreeLabelProps>(({ className, children, ...props }, ref) => (
  <span ref={ref} className={cn('truncate text-foreground', className)} {...props}>
    {children}
  </span>
));
TreeLabel.displayName = 'Tree.Label';
