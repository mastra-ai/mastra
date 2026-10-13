import type { ComponentProps, ComponentPropsWithoutRef, CSSProperties, ReactNode } from 'react';
import { forwardRef, useEffect, useRef } from 'react';
import { Cell } from './Cells';
import { tableAlignClasses } from './table-align';
import type { TableAlign } from './table-align';
import { TableVariantContext, useTableVariant } from './table-context';
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

export function Table({
  className,
  children,
  size = 'default',
  style,
  variant = 'default',
  columnDividers,
  ...props
}: TableProps) {
  return (
    <TableVariantContext value={variant}>
      {variant === 'inset' ? (
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
                style={style}
                {...props}
              >
                {children}
              </table>
            </div>
          </div>
        </div>
      ) : (
        <table className={cn('w-full', rowSize[size], className)} style={style} {...props}>
          {children}
        </table>
      )}
    </TableVariantContext>
  );
}

export type TableHeaderProps = ComponentProps<'thead'>;

function TableHeader({ className, ...props }: TableHeaderProps) {
  const variant = useTableVariant();
  return (
    <thead
      data-slot="table-header"
      className={cn(
        variant === 'default' && '[&>tr]:h-table-header [&>tr]:border-b [&>tr]:border-border [&>tr]:bg-card',
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

export const Th = ({ className, children, ...props }: ThProps) => {
  const variant = useTableVariant();
  const { align = 'start', ...insetProps } = props;
  const insetAlign = align === 'center' ? 'center' : align === 'end' || align === 'right' ? 'end' : 'start';
  return (
    <th
      className={cn(
        variant === 'inset'
          ? cn(
              'group/head h-10 px-2 align-middle text-column whitespace-nowrap text-muted-foreground first:pl-3 last:pr-3',
              'border-transparent group-data-column-dividers/table:border-l group-data-column-dividers/table:px-3',
              tableAlignClasses[insetAlign],
            )
          : 'h-full text-left text-meta tracking-wide whitespace-nowrap text-placeholder uppercase first:pl-3 last:pr-3',
        className,
      )}
      data-slot={variant === 'inset' ? 'table-head' : undefined}
      data-align={variant === 'inset' ? insetAlign : undefined}
      {...(variant === 'inset' ? insetProps : props)}
    >
      {children}
    </th>
  );
};

const tableBodyStyles = [
  '[&>tr+tr>td]:border-t',
  '[&>tr:first-child>td:first-child]:rounded-tl-lg',
  '[&>tr:first-child>td:last-child]:rounded-tr-lg',
  '[&>tr:first-child_[data-row-target]]:after:rounded-t-lg',
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
      data-slot={variant === 'inset' ? 'table-body' : undefined}
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
    useEffect(() => {
      if (!ref) return;
      if (typeof ref === 'function') {
        ref(internalRef.current);
      } else {
        ref.current = internalRef.current;
      }
    }, [ref]);

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
        data-slot={variant === 'inset' ? 'table-row' : undefined}
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
