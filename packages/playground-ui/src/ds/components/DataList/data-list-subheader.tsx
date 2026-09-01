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
          'relative isolate col-span-full mt-2 border-none px-5 py-3 text-ui-md font-medium text-neutral4',
          'before:absolute before:inset-0 before:-z-1 before:rounded-lg before:bg-[var(--data-list-sticky-header-background)]',
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
