import React, { forwardRef } from 'react';
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

export interface TbodyProps {
  className?: string;
  children: React.ReactNode;
}

export const Tbody = ({ className, children }: TbodyProps) => {
  return <tbody className={cn('', className)}>{children}</tbody>;
};

export interface RowProps {
  className?: string;
  children: React.ReactNode;
  selected?: boolean;
  style?: React.CSSProperties;
  onClick?: () => void;
  tabIndex?: number;
}

export const Row = forwardRef<HTMLTableRowElement, RowProps>(
  ({ className, children, selected = false, style, onClick, ...props }, ref) => {
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
          'focus:bg-surface3 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-accent1/50',
          selected && 'bg-surface4',
          onClick && 'cursor-pointer',
          className,
        )}
        style={style}
        onClick={onClick}
        ref={ref}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={handleKeyDown}
        {...props}
      >
        {children}
      </tr>
    );
  },
);
