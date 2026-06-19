import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';
import { forwardRef } from 'react';
import { dataListStickyStartStyles } from './shared';
import type { DataListSticky } from './shared';
import { Checkbox } from '@/ds/components/Checkbox';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/ds/components/Tooltip';
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
          'h-8 min-w-0 max-w-full overflow-hidden py-1 flex items-center whitespace-nowrap text-neutral2 font-semibold tracking-tight text-ui-sm',
          sticky === 'start' && dataListStickyStartStyles,
          sticky === 'start' && 'z-20',
          className,
        )}
        {...rest}
      >
        {/* Plain string/number titles truncate with an ellipsis; element children
            (icons, smart long/short labels, checkboxes) render as-is. */}
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

export function DataListTopCellWithTooltip({ children, tooltip, className }: DataListTopCellWithTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger>
        <DataListTopCell className={className}>{children}</DataListTopCell>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export type DataListTopCellSmartProps = {
  long: ReactNode;
  short: ReactNode;
  tooltip?: string;
  breakpoint?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
};

const breakpointClasses: Record<string, { show: string; hide: string }> = {
  sm: { show: 'hidden sm:inline-flex', hide: 'inline-flex sm:hidden' },
  md: { show: 'hidden md:inline-flex', hide: 'inline-flex md:hidden' },
  lg: { show: 'hidden lg:inline-flex', hide: 'inline-flex lg:hidden' },
  xl: { show: 'hidden xl:inline-flex', hide: 'inline-flex xl:hidden' },
  '2xl': { show: 'hidden 2xl:inline-flex', hide: 'inline-flex 2xl:hidden' },
};

export function DataListTopCellSmart({
  long,
  short,
  tooltip,
  breakpoint = '2xl',
  className,
}: DataListTopCellSmartProps) {
  const tooltipText = tooltip ?? (typeof long === 'string' ? long : undefined);
  const bp = breakpointClasses[breakpoint];

  const content = (
    <>
      <span className={cn('items-center gap-1', bp.show)}>{long}</span>
      <span className={cn('items-center gap-1', bp.hide)}>{short}</span>
    </>
  );

  if (tooltipText) {
    return (
      <DataListTopCellWithTooltip
        tooltip={tooltipText}
        className={cn('flex [&_svg]:w-[1.3em] [&_svg]:h-[1.3em]', className)}
      >
        {content}
      </DataListTopCellWithTooltip>
    );
  }

  return (
    <DataListTopCell className={cn('flex [&_svg]:w-[1.3em] [&_svg]:h-[1.3em]', className)}>{content}</DataListTopCell>
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
