import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TreeIconProps {
  className?: string;
  children: React.ReactNode;
}

export const TreeIcon = React.forwardRef<HTMLSpanElement, TreeIconProps>(({ className, children }, ref) => (
  <span ref={ref} className={cn('flex shrink-0 items-center [&>svg]:size-3.5', className)}>
    {children}
  </span>
));
TreeIcon.displayName = 'Tree.Icon';
