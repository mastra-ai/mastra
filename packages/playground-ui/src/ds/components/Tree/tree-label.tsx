import * as React from 'react';
import { Txt } from '@/ds/components/Txt';
import type { TextStyleProps } from '@/ds/primitives/text';
import { cn } from '@/lib/utils';

export interface TreeLabelProps extends TextStyleProps {
  className?: string;
  children: React.ReactNode;
}

export const TreeLabel = React.forwardRef<HTMLSpanElement, TreeLabelProps>(
  ({ className, children, variant = 'caption', tone = 'ink', font }, ref) => (
    <Txt as="span" ref={ref} variant={variant} tone={tone} font={font} className={cn('truncate', className)}>
      {children}
    </Txt>
  ),
);
TreeLabel.displayName = 'Tree.Label';
