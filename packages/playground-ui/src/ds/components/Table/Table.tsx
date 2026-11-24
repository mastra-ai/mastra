import type { ComponentProps, ComponentPropsWithoutRef, CSSProperties, ReactNode } from 'react';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Cell } from './Cells';
import { resolveTableAlign, tableAlignClasses, toNativeAlign } from './table-align';
import type { TableAlign } from './table-align';
import { insetSlot, TableVariantContext, useTableVariant } from './table-context';
import type { TableVariant } from './table-context';
import { TablePagination } from './table-pagination';
import { TableRowButton } from './table-row-button';
import { TableRowLink } from './table-row-link';
import { forwardRowClick, isForwardedRowClick } from './table-row-target';
import { TableSortButton } from './table-sort-button';
import { fieldsOnNested, raisedSurfaceStyle } from '@/ds/primitives/raised-surface';
import { focusRingInset } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export interface TableProps extends ComponentProps<'table'> {
  className?: string;
  children: ReactNode;
  size?: 'default' | 'small';
  variant?: TableVariant;
  columnDividers?: boolean;
  style?: CSSProperties;
}

const rowSize = {
  default: '[&>tbody>tr]:h-table-row',
  small: '[&>tbody>tr]:h-table-row-small',
};

type TableFrameProps = Omit<TableProps, 'variant'> & { variant: TableVariant };

const tableSurface = {
  inset: cn('rounded-xl p-1', raisedSurfaceStyle),
  nested: cn('rounded-lg bg-nested', fieldsOnNested),
};

type InsetTableProps = Omit<TableProps, 'variant' | 'size'> & { variant: keyof typeof tableSurface };

function InsetTable({ variant, className, columnDividers, ...props }: InsetTableProps) {
  return (
    <div
      data-slot="table-container"
      data-column-dividers={columnDividers || undefined}
      className={cn('group/table w-full', tableSurface[variant], className)}
    >
      <div data-slot="table-scroll" className="overflow-x-auto rounded-lg">
        <div className="group-data-column-dividers/table:-ml-px">
          <table
            data-slot="table"
            className="w-full border-separate border-spacing-0 text-body-sm tabular-nums"
            tabIndex={0}
            {...props}
          />
        </div>
      </div>
    </div>
  );
}

function TableFrame({ variant, size = 'default', className, columnDividers, ...props }: TableFrameProps) {
  if (variant === 'default') return <table className={cn('w-full', rowSize[size], className)} {...props} />;
  return <InsetTable variant={variant} className={className} columnDividers={columnDividers} {...props} />;
}

export function Table({ variant = 'default', ...props }: TableProps) {
  return (
    <TableVariantContext value={variant}>
      <TableFrame variant={variant} {...props} />
    </TableVariantContext>
  );
}

export type TableHeaderProps = ComponentProps<'thead'> & {
  placement?: 'above' | 'inside';
};

const insideHeaderStyles = [
  '[&>tr>th]:border-b [&>tr>th]:bg-row [&>tr>th]:bg-clip-padding',
  '[&>tr>th:first-child]:rounded-tl-lg [&>tr>th:last-child]:rounded-tr-lg',
];

function TableHeader({ className, placement = 'above', ...props }: TableHeaderProps) {
  const variant = useTableVariant();
  const inside = variant === 'inset' && placement === 'inside';
  const headerPlacement = inside ? 'inside' : undefined;
  return (
    <thead
      data-slot="table-header"
      data-placement={headerPlacement}
      className={cn(
        variant === 'default' && '[&>tr]:h-table-header [&>tr]:border-b [&>tr]:border-border [&>tr]:bg-card',
        inside && insideHeaderStyles,
        className,
      )}
      {...props}
    />
  );
}

export interface TheadProps {
  className?: string;
  children: ReactNode;
}

export const Thead = ({ className, children }: TheadProps) => {
  const variant = useTableVariant();
  return (
    <thead>
      <tr className={cn(variant === 'default' && 'h-table-header border-b border-border bg-card', className)}>
        {children}
      </tr>
    </thead>
  );
};

export interface ThProps extends Omit<ComponentProps<'th'>, 'align'> {
  align?: TableAlign | ComponentProps<'th'>['align'];
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

const insetHeadClass = cn(
  'group/head h-10 px-2 align-middle text-column whitespace-nowrap text-muted-foreground first:pl-3 last:pr-3',
  'group-data-column-dividers/table:border-l group-data-column-dividers/table:px-3',
);

const headBorderClass = {
  inset: 'border-transparent',
  nested: 'border-x-transparent border-b border-b-separator',
};

const legacyHeadClass =
  'h-full text-left text-meta tracking-wide whitespace-nowrap text-muted-foreground uppercase first:pl-3 last:pr-3';

export const Th = ({ className, children, align, ...props }: ThProps) => {
  const variant = useTableVariant();
  if (variant !== 'default') {
    const insetAlign = resolveTableAlign(align);
    return (
      <th
        className={cn(insetHeadClass, headBorderClass[variant], tableAlignClasses[insetAlign], className)}
        data-slot="table-head"
        data-align={insetAlign}
        {...props}
      >
        {children}
      </th>
    );
  }
  return (
    <th className={cn(legacyHeadClass, className)} {...props} align={toNativeAlign(align)}>
      {children}
    </th>
  );
};

const rowDividers = '[&>tr+tr>td]:border-t';

const insetBodyStyles = [
  '[&>tr:first-child>td:first-child]:rounded-tl-lg',
  '[&>tr:first-child>td:last-child]:rounded-tr-lg',
  '[thead[data-placement=inside]+&>tr:first-child>td]:rounded-none',
];

export interface TbodyProps extends ComponentProps<'tbody'> {
  className?: string;
  children: ReactNode;
}

export const Tbody = ({ className, children, ...props }: TbodyProps) => {
  const variant = useTableVariant();
  return (
    <tbody
      data-slot={insetSlot(variant, 'table-body')}
      className={cn(variant !== 'default' && rowDividers, variant === 'inset' && insetBodyStyles, className)}
      {...props}
    >
      {children}
    </tbody>
  );
};

export interface RowProps extends Omit<ComponentPropsWithoutRef<'tr'>, 'onClick'> {
  className?: string;
  children: ReactNode;
  selected?: boolean;
  style?: CSSProperties;
  onClick?: () => void;
  tabIndex?: number;
  /** When true, row receives focus and scrolls into view */
  isActive?: boolean;
}

export const Row = forwardRef<HTMLTableRowElement, RowProps>(
  ({ className, children, selected = false, style, onClick, isActive = false, ...props }, ref) => {
    const variant = useTableVariant();
    const internalRef = useRef<HTMLTableRowElement>(null);

    // Merge forwarded ref with internal ref
    useImperativeHandle<HTMLTableRowElement | null, HTMLTableRowElement | null>(ref, () => internalRef.current, []);

    // Focus and scroll into view when active
    useEffect(() => {
      if (isActive && internalRef.current) {
        internalRef.current.focus();
        internalRef.current.scrollIntoView({ block: 'nearest' });
      }
    }, [isActive]);

    const handleInsetClick = (event: React.MouseEvent<HTMLTableRowElement>) => {
      // The click handed to the row target bubbles back here; the original click already ran onClick
      // and already reached the row's ancestors, so this copy stops at the row.
      if (isForwardedRowClick(event)) {
        event.stopPropagation();
        return;
      }
      forwardRowClick(event);
      onClick?.();
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLTableRowElement>) => {
      if (event.key === 'Enter' && onClick) {
        onClick();
      }
    };

    return (
      <tr
        className={cn(
          variant === 'default' && 'border-b border-border',
          // Smooth hover transition
          variant === 'default' && 'transition-colors duration-normal ease-out-custom',
          variant === 'default' && 'hover:bg-fill-subtle',
          variant === 'default' && 'focus:bg-fill-subtle',
          variant === 'default' && focusRingInset,
          variant === 'inset' && [
            'has-[[data-row-target]]:hover:*:bg-surface-panel',
            'has-[[data-row-target]:focus-visible]:*:bg-surface-panel',
          ],
          variant === 'nested' && [
            'has-[[data-row-target]]:hover:*:bg-fill-subtle',
            'has-[[data-row-target]:focus-visible]:*:bg-fill-subtle',
          ],
          variant !== 'default' && [
            'has-[[data-row-target]]:cursor-pointer',
            'has-[[data-row-target]:focus-visible]:outline-1 has-[[data-row-target]:focus-visible]:-outline-offset-1',
            'has-[[data-row-target]:focus-visible]:outline-border-focus has-[[data-row-target]:focus-visible]:outline-solid',
          ],
          selected && 'bg-fill-hover',
          onClick && 'cursor-pointer',
          className,
        )}
        data-slot={insetSlot(variant, 'table-row')}
        style={style}
        onClick={variant === 'default' ? onClick : handleInsetClick}
        ref={internalRef}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={handleKeyDown}
        data-active={isActive || undefined}
        {...props}
      >
        {children}
      </tr>
    );
  },
);

Table.Header = TableHeader;
Table.Body = Tbody;
Table.Row = Row;
Table.Head = Th;
Table.Cell = Cell;
Table.RowLink = TableRowLink;
Table.RowButton = TableRowButton;
Table.SortButton = TableSortButton;
Table.Pagination = TablePagination;
