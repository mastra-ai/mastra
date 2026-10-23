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
import { TableSortButton } from './table-sort-button';
import { raisedSurfaceStyle } from '@/ds/primitives/raised-surface';
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

function InsetTable({ className, columnDividers, ...props }: Omit<TableProps, 'variant' | 'size'>) {
  return (
    <div
      data-slot="table-container"
      data-column-dividers={columnDividers || undefined}
      className={cn('group/table w-full rounded-xl p-1', raisedSurfaceStyle, className)}
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
  if (variant === 'inset') return <InsetTable className={className} columnDividers={columnDividers} {...props} />;
  return <table className={cn('w-full', rowSize[size], className)} {...props} />;
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
  '[&>tr>th]:border-b [&>tr>th]:bg-background [&>tr>th]:bg-clip-padding',
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
  'border-transparent group-data-column-dividers/table:border-l group-data-column-dividers/table:px-3',
);

const legacyHeadClass =
  'h-full text-left text-meta tracking-wide whitespace-nowrap text-placeholder uppercase first:pl-3 last:pr-3';

export const Th = ({ className, children, align, ...props }: ThProps) => {
  const variant = useTableVariant();
  if (variant === 'inset') {
    const insetAlign = resolveTableAlign(align);
    return (
      <th
        className={cn(insetHeadClass, tableAlignClasses[insetAlign], className)}
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

const tableBodyStyles = [
  '[&>tr+tr>td]:border-t',
  '[&>tr:first-child>td:first-child]:rounded-tl-lg',
  '[&>tr:first-child>td:last-child]:rounded-tr-lg',
  '[&>tr:first-child_[data-row-target]]:after:rounded-t-lg',
  '[thead[data-placement=inside]+&>tr:first-child>td]:rounded-none',
  '[thead[data-placement=inside]+&>tr:first-child_[data-row-target]]:after:rounded-none',
  '[&>tr:last-child_[data-row-target]]:after:rounded-b-lg',
  '[&_:is(a,button,input,select,textarea):not([data-row-target])]:relative',
  '[&_:is(a,button,input,select,textarea):not([data-row-target])]:z-1',
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
      className={cn(variant === 'inset' && tableBodyStyles, className)}
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
            'has-[[data-row-target]]:relative',
            'has-[[data-row-target]]:hover:*:bg-surface-panel',
            'has-[[data-row-target]:focus-visible]:*:bg-surface-panel',
          ],
          selected && 'bg-fill-hover',
          onClick && 'cursor-pointer',
          className,
        )}
        data-slot={insetSlot(variant, 'table-row')}
        style={style}
        onClick={onClick}
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
