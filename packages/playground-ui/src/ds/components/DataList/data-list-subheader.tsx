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
          'data-list-subheader relative isolate col-span-full px-5 py-3 text-ui-md font-medium text-neutral4',
          'bg-(--data-list-background)',
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
