import React, { forwardRef, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface TableProps {
  className?: string;
  children: React.ReactNode;
  size?: 'default' | 'small';
  style?: React.CSSProperties;
}

const rowSize = {
  default: '[&>tbody>tr]:h-table-row',
  small: '[&>tbody>tr]:h-table-row-small',
};

export const Table = ({ className, children, size = 'default', style }: TableProps) => {
  return (
    <table className={cn('w-full', rowSize[size], className)} style={style}>
      {children}
    </table>
  );
};

export interface TheadProps {
  className?: string;
  children: React.ReactNode;
}

export const Thead = ({ className, children }: TheadProps) => {
  return (
    <thead>
      <tr className={cn('h-table-header border-b border-border1 bg-surface2/80', className)}>{children}</tr>
    </thead>
  );
};

export interface ThProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  className?: string;
  children: React.ReactNode;
}

export const Th = ({ className, children, ...props }: ThProps) => {
  return (
    <th
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

export interface TbodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  className?: string;
  children: React.ReactNode;
}

export const Tbody = ({ className, children, ...props }: TbodyProps) => {
  return (
    <tbody className={cn('', className)} {...props}>
      {children}
    </tbody>
  );
};

export interface RowProps {
  className?: string;
  children: React.ReactNode;
  selected?: boolean;
  style?: React.CSSProperties;
  onClick?: () => void;
  tabIndex?: number;
  /** When true, row receives focus and scrolls into view */
  isActive?: boolean;
}

export const Row = forwardRef<HTMLTableRowElement, RowProps>(
  ({ className, children, selected = false, style, onClick, isActive = false, ...props }, ref) => {
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
          'border-b border-border1',
          // Smooth hover transition
          'transition-colors duration-normal ease-out-custom',
          'hover:bg-surface3',
          // Focus state
          'focus:bg-table-selected-row focus:outline-none focus:ring-1 focus:ring-inset focus:ring-primary/50',
          selected && 'bg-table-selected-row',
          onClick && 'cursor-pointer',
          className,
        )}
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
