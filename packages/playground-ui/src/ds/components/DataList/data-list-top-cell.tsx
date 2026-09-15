import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';
import { forwardRef } from 'react';
import { dataListStickyStartStyles } from './shared';
import type { DataListSticky } from './shared';
import { Button } from '@/ds/components/Button';
import { Checkbox } from '@/ds/components/Checkbox';
import { cn } from '@/lib/utils';

export type DataListTopCellProps = {
  children: ReactNode;
  className?: string;
  /**
   * HTML element rendered for the top cell. Defaults to `span`. Use `'label'`
   * when the cell wraps a labelable control (e.g. a select-all Checkbox).
   */
  as?: ElementType;
  /** Pins the top cell to the horizontal start edge while the list scrolls sideways. */
  sticky?: DataListSticky;
} & Omit<ComponentPropsWithoutRef<'div'>, 'children' | 'className' | 'ref'>;

export const DataListTopCell = forwardRef<HTMLSpanElement, DataListTopCellProps>(
  ({ children, className, as, sticky, ...rest }, ref) => {
    const Component = as || 'span';
    const isText = typeof children === 'string' || typeof children === 'number';
    return (
      <Component
        ref={ref}
        className={cn(
          'flex h-10 max-w-full min-w-0 items-center overflow-hidden py-1 text-ui-sm font-medium whitespace-nowrap text-neutral2',
          sticky === 'start' && dataListStickyStartStyles,
          sticky === 'start' && '-mr-3 -ml-3 w-auto max-w-none pr-3 pl-3',
          sticky === 'start' && 'z-20',
          className,
        )}
        {...rest}
      >
        {isText ? <span className="min-w-0 truncate">{children}</span> : children}
      </Component>
    );
  },
);

export type DataListTopCellWithTooltipProps = {
  children: ReactNode;
  tooltip: ReactNode;
  className?: string;
};

function DataListHeaderTooltip({
  children,
  tooltip,
  className,
  iconOnly = false,
}: DataListTopCellWithTooltipProps & { iconOnly?: boolean }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size={iconOnly ? 'icon-sm' : 'sm'}
      tooltip={tooltip}
      className={cn('max-w-full', className)}
    >
      {typeof children === 'string' || typeof children === 'number' ? (
        <span className="truncate">{children}</span>
      ) : (
        children
      )}
    </Button>
  );
}

export function DataListTopCellWithTooltip({ children, tooltip, className }: DataListTopCellWithTooltipProps) {
  return (
    <DataListTopCell className={className}>
      <DataListHeaderTooltip tooltip={tooltip}>{children}</DataListHeaderTooltip>
    </DataListTopCell>
  );
}

export type DataListTopCellSmartProps = {
  long: ReactNode;
  short: ReactNode;
  shortIsIcon?: boolean;
  tooltip?: string;
  breakpoint?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
};

const breakpointClasses: Record<'sm' | 'md' | 'lg' | 'xl' | '2xl', { show: string; hide: string }> = {
  sm: { show: 'hidden sm:inline-flex', hide: 'inline-flex sm:hidden' },
  md: { show: 'hidden md:inline-flex', hide: 'inline-flex md:hidden' },
  lg: { show: 'hidden lg:inline-flex', hide: 'inline-flex lg:hidden' },
  xl: { show: 'hidden xl:inline-flex', hide: 'inline-flex xl:hidden' },
  '2xl': { show: 'hidden 2xl:inline-flex', hide: 'inline-flex 2xl:hidden' },
};

export function DataListTopCellSmart({
  long,
  short,
  shortIsIcon = false,
  tooltip,
  breakpoint = '2xl',
  className,
}: DataListTopCellSmartProps) {
  const tooltipText = tooltip ?? (typeof long === 'string' ? long : undefined);
  const bp = breakpointClasses[breakpoint];

  if (tooltipText) {
    return (
      <DataListTopCell className={className}>
        <DataListHeaderTooltip tooltip={tooltipText} className={bp.show}>
          {long}
        </DataListHeaderTooltip>
        <DataListHeaderTooltip tooltip={tooltipText} iconOnly={shortIsIcon} className={bp.hide}>
          {short}
        </DataListHeaderTooltip>
      </DataListTopCell>
    );
  }

  return (
    <DataListTopCell className={cn('flex [&_svg]:size-[1.3em]', className)}>
      <span className={cn('items-center gap-1', bp.show)}>{long}</span>
      <span className={cn('items-center gap-1', bp.hide)}>{short}</span>
    </DataListTopCell>
  );
}

export interface DataListTopSelectCellProps {
  /** Pass `'indeterminate'` when some — but not all — rows are selected. */
  checked: boolean | 'indeterminate';
  /** Toggles the global selection. Typically clears when fully selected, otherwise selects all. */
  onToggle: () => void;
  'aria-label'?: string;
}

export function DataListTopSelectCell({ checked, onToggle, ...rest }: DataListTopSelectCellProps) {
  return (
    <DataListTopCell
      as="label"
      className="w-8 cursor-pointer justify-center overflow-visible px-0 py-0!"
      onClick={e => e.stopPropagation()}
    >
      <Checkbox checked={checked} onCheckedChange={() => onToggle()} aria-label={rest['aria-label']} />
    </DataListTopCell>
  );
}
