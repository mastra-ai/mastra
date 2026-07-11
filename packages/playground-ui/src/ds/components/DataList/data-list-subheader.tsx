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
          'data-list-subheader relative isolate col-span-full px-4 py-3 border-none text-ui-md text-neutral4 font-medium mx-1',
          'before:absolute before:inset-x-0 before:inset-y-1 before:bg-surface4 before:rounded-md before:-z-1',
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
