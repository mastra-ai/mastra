import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import { useDataListRowWrapperContext } from './data-list-row-wrapper-context';
import { dataListRowStaticStyles } from './shared';
import type { DataListRowSharedProps } from './shared';
import { cn } from '@/lib/utils';

export type DataListRowStaticProps = ComponentPropsWithoutRef<'div'> & DataListRowSharedProps;

/**
 * Non-interactive row. Use when a row should *display* like a regular row but
 * has no link target or click handler
 */
export const DataListRowStatic = forwardRef<HTMLDivElement, DataListRowStaticProps>(
  ({ children, className, colStart, colEnd, featured, variant, style, ...rest }, ref) => {
    const isWrapped = useDataListRowWrapperContext();
    const hasColumnOverride = colStart !== undefined || colEnd !== undefined;
    const resolvedStyle = hasColumnOverride ? { ...style, gridColumn: `${colStart ?? 1} / ${colEnd ?? -1}` } : style;
    return (
      <div
        ref={ref}
        className={cn(
          isWrapped ? 'grid grid-cols-subgrid gap-8 px-5 transition-colors duration-200' : dataListRowStaticStyles,
          className,
        )}
        style={resolvedStyle}
        data-featured={featured || undefined}
        data-variant={variant ?? 'default'}
        {...rest}
      >
        {children}
      </div>
    );
  },
);

DataListRowStatic.displayName = 'DataListRowStatic';
