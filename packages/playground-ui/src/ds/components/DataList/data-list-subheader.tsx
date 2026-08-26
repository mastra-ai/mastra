import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

export type DataListSubheaderProps = ComponentPropsWithoutRef<'div'>;

export const DataListSubheader = forwardRef<HTMLDivElement, DataListSubheaderProps>(
  ({ children, className, ...rest }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'data-list-subheader relative isolate col-span-full mx-1 border-none px-4 py-3 text-ui-md font-medium text-neutral4',
          'before:absolute before:inset-x-0 before:inset-y-1 before:-z-1 before:rounded-md before:bg-surface4',
          className,
        )}
        {...rest}
      >
        {children}
      </div>
    );
  },
);

DataListSubheader.displayName = 'DataListSubheader';
