import type { CSSProperties, HTMLAttributes, KeyboardEvent, ReactNode, ThHTMLAttributes } from 'react';
import { createContext, forwardRef, useContext, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export type TableVariant = 'default' | 'striped' | 'lined';
export type TableSize = 'default' | 'small';

export interface TableProps {
  className?: string;
  containerClassName?: string;
  children: ReactNode;
  size?: TableSize;
  variant?: TableVariant;
  style?: CSSProperties;
}

const rowSize = {
  default: '[&>tbody>tr]:h-table-row',
  small: '[&>tbody>tr]:h-table-row-small',
};

const tableContainerStyles: Record<TableVariant, string> = {
  default: 'max-w-full overflow-x-auto rounded-lg border border-border1 bg-surface2',
  striped: 'max-w-full overflow-x-auto rounded-t-xl',
  lined: 'max-w-full overflow-x-auto rounded-t-xl',
};

type TableContextValue = {
  variant: TableVariant;
};

const tableContextValues = {
  default: { variant: 'default' },
  striped: { variant: 'striped' },
  lined: { variant: 'lined' },
} satisfies Record<TableVariant, TableContextValue>;

const TableContext = createContext<TableContextValue>(tableContextValues.default);
const TableSectionContext = createContext<'head' | 'body'>('body');

function useTableContext() {
  return useContext(TableContext);
}

function useTableSectionContext() {
  return useContext(TableSectionContext);
}

export const Table = ({
  className,
  containerClassName,
  children,
  size = 'default',
  variant = 'default',
  style,
}: TableProps) => {
  return (
    <TableContext.Provider value={tableContextValues[variant]}>
      <div className={cn(tableContainerStyles[variant], containerClassName)}>
        <table className={cn('w-full border-collapse', rowSize[size], className)} style={style}>
          {children}
        </table>
      </div>
    </TableContext.Provider>
  );
};

export interface TableHeaderProps extends HTMLAttributes<HTMLTableSectionElement> {
  className?: string;
  children: ReactNode;
}

export const TableHeader = ({ className, children, ...props }: TableHeaderProps) => {
  return (
    <TableSectionContext.Provider value="head">
      <thead className={className} {...props}>
        {children}
      </thead>
    </TableSectionContext.Provider>
  );
};

export interface TheadProps {
  className?: string;
  children: ReactNode;
}

export const Thead = ({ className, children }: TheadProps) => {
  return (
    <TableHeader>
      <Row className={className}>{children}</Row>
    </TableHeader>
  );
};

export interface TableBodyProps extends HTMLAttributes<HTMLTableSectionElement> {
  className?: string;
  children: ReactNode;
}

export const TableBody = ({ className, children, ...props }: TableBodyProps) => {
  return (
    <TableSectionContext.Provider value="body">
      <tbody className={className} {...props}>
        {children}
      </tbody>
    </TableSectionContext.Provider>
  );
};

export interface TbodyProps extends TableBodyProps {}

export const Tbody = ({ className, children, ...props }: TbodyProps) => {
  return (
    <TableBody className={className} {...props}>
      {children}
    </TableBody>
  );
};

const headerRowStyles: Record<TableVariant, string> = {
  default: 'h-table-header border-b border-border1 bg-surface2/80',
  striped: 'h-table-header border-b border-transparent bg-surface4',
  lined: 'h-table-header border-b border-border1 bg-surface4',
};

const bodyRowStyles: Record<TableVariant, string> = {
  default: 'border-b border-border1 hover:bg-surface3 focus:bg-surface3',
  striped:
    'border-b border-transparent even:bg-surface-overlay-soft hover:bg-surface-overlay-strong focus:bg-surface-overlay-strong',
  lined: 'border-b border-neutral6/10 hover:bg-surface-overlay-strong focus:bg-surface-overlay-strong',
};

export interface RowProps extends Omit<HTMLAttributes<HTMLTableRowElement>, 'onClick'> {
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
  ({ className, children, selected = false, style, onClick, isActive = false, onKeyDown, ...props }, ref) => {
    const { variant } = useTableContext();
    const section = useTableSectionContext();
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

    const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented) return;

      if ((event.key === 'Enter' || event.key === ' ') && onClick) {
        event.preventDefault();
        onClick();
      }
    };

    if (section === 'head') {
      return (
        <tr ref={internalRef} className={cn(headerRowStyles[variant], className)} style={style} {...props}>
          {children}
        </tr>
      );
    }

    return (
      <tr
        className={cn(
          bodyRowStyles[variant],
          'transition-colors duration-normal ease-out-custom',
          'focus:outline-hidden focus:ring-1 focus:ring-inset focus:ring-accent1/50',
          selected && 'bg-surface4',
          onClick && 'cursor-pointer',
          className,
        )}
        style={style}
        onClick={onClick}
        ref={internalRef}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={handleKeyDown}
        aria-selected={selected || undefined}
        data-active={isActive || undefined}
        {...props}
      >
        {children}
      </tr>
    );
  },
);

export const TableRow = Row;

export interface ThProps extends ThHTMLAttributes<HTMLTableCellElement> {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

export const Th = ({ className, children, scope = 'col', ...props }: ThProps) => {
  return (
    <th
      scope={scope}
      className={cn(
        'text-neutral2 text-ui-xs h-full whitespace-nowrap text-left font-medium uppercase tracking-wide first:pl-3 last:pr-3',
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
};

export const TableHead = Th;
