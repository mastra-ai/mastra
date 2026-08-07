import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import { useDataListRowWrapperContext } from './data-list-row-wrapper-context';
import { dataListRowInteractiveStyles, dataListRowStyles, dataListRowVariants } from './shared';
import type { DataListRowSharedProps } from './shared';
import { cn } from '@/lib/utils';

export type DataListRowButtonProps = ComponentPropsWithoutRef<'button'> & DataListRowSharedProps;

/**
 * Forwarded ref + spread props so virtualizers (`useVirtualizer.measureElement`)
 * can attach a ref and `data-index` to each rendered row.
 */
export const DataListRowButton = forwardRef<HTMLButtonElement, DataListRowButtonProps>(
  (
    {
      children,
      className,
      type = 'button',
      flushLeft,
      flushRight,
      colStart,
      colEnd,
      featured,
      variant,
      style,
      ...rest
    },
    ref,
  ) => {
    const isWrapped = useDataListRowWrapperContext();
    const hasColumnOverride = colStart !== undefined || colEnd !== undefined;
    const resolvedStyle = hasColumnOverride ? { ...style, gridColumn: `${colStart ?? 1} / ${colEnd ?? -1}` } : style;
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          ...(isWrapped ? dataListRowInteractiveStyles : dataListRowStyles),
          'text-left',
          !isWrapped && flushLeft && 'ml-0!',
          !isWrapped && flushRight && 'mr-0!',
          // `!` so the selection fill wins over borderless table root styling
          // (higher-specificity descendant rules); same color in `default`.
          featured && 'bg-surface4!',
          dataListRowVariants({ variant }),
          className,
        )}
        style={resolvedStyle}
        {...rest}
      >
        {children}
      </button>
    );
  },
);

DataListRowButton.displayName = 'DataListRowButton';
