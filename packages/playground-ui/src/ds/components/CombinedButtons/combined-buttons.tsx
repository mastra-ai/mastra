import { cn } from '@/lib/utils';
import { formElementBorder } from '@/ds/primitives/form-element';
import React from 'react';

export interface CombinedButtonsProps {
  className?: string;
  children: React.ReactNode;
}

export const CombinedButtons = ({ className, children }: CombinedButtonsProps) => {
  return (
    <div
      className={cn(
        'flex items-center text-ui-sm rounded-lg overflow-hidden',
        formElementBorder,
        '[&>button]:border-0 [&>button:not(:first-child)]:border-l [&>button:not(:first-child)]:border-border1',
        '[&>button]:rounded-none [&>button:first-child]:rounded-l-lg [&>button:last-child]:rounded-r-lg',
        className,
      )}
    >
      {children}
    </div>
  );
};
