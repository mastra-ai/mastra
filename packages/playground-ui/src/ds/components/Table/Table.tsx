import clsx from 'clsx';
import React, { forwardRef } from 'react';

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
    <table className={clsx('w-full', rowSize[size], className)} style={style}>
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
      <tr className={clsx('h-table-header border-b-sm border-border1 bg-surface2', className)}>{children}</tr>
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
      className={clsx(
        'text-icon3 text-ui-sm h-full whitespace-nowrap text-left font-normal uppercase first:pl-5 last:pr-5',
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
  return <tbody className={clsx('', className)}>{children}</tbody>;
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
        className={clsx(
          'border-b-sm border-border1 hover:bg-surface3 focus:bg-surface3 -outline-offset-2',
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
