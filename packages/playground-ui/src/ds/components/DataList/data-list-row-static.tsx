import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import { useDataListRowWrapperContext } from './data-list-row-wrapper-context';
import { dataListRowStaticStyles, dataListRowVariants } from './shared';
import type { DataListRowSharedProps } from './shared';
import { cn } from '@/lib/utils';

export type DataListRowStaticProps = ComponentPropsWithoutRef<'div'> & DataListRowSharedProps;

/**
 * Non-interactive row. Use when a row should *display* like a regular row but
 * has no link target or click handler
 */
export const DataListRowStatic = forwardRef<HTMLDivElement, DataListRowStaticProps>(
  ({ children, className, flushLeft, flushRight, colStart, colEnd, featured, variant, style, ...rest }, ref) => {
    const isWrapped = useDataListRowWrapperContext();
    const hasColumnOverride = colStart !== undefined || colEnd !== undefined;
    const resolvedStyle = hasColumnOverride ? { ...style, gridColumn: `${colStart ?? 1} / ${colEnd ?? -1}` } : style;
    return (
      <div
        ref={ref}
        className={cn(
          isWrapped
            ? 'grid grid-cols-subgrid gap-8 px-5 transition-colors duration-200 rounded-lg'
            : dataListRowStaticStyles,
          !isWrapped && flushLeft && 'ml-0!',
          !isWrapped && flushRight && 'mr-0!',
          // `!` so the selection fill wins over the striped variant's zebra tint
          // (a higher-specificity root descendant rule); same color in `default`.
          featured && 'bg-surface4!',
          dataListRowVariants({ variant }),
          className,
        )}
        style={resolvedStyle}
        {...rest}
      >
        {children}
      </div>
    );
  },
);

DataListRowStatic.displayName = 'DataListRowStatic';
