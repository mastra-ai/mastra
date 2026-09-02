import type { CSSProperties, HTMLAttributes, ReactNode, ThHTMLAttributes } from 'react';
import { forwardRef, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface TableProps {
  className?: string;
  children: ReactNode;
  size?: 'default' | 'small';
  style?: CSSProperties;
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
  children: ReactNode;
}

export const Thead = ({ className, children }: TheadProps) => {
  return (
    <thead>
      <tr className={cn('h-table-header border-b border-gray-alpha-3 bg-background-2/80', className)}>{children}</tr>
    </thead>
  );
};

export interface ThProps extends ThHTMLAttributes<HTMLTableCellElement> {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

export const Th = ({ className, children, ...props }: ThProps) => {
  return (
    <th
      className={cn(
        'h-full text-left text-ui-xs font-medium tracking-wide whitespace-nowrap text-gray-9 uppercase first:pl-3 last:pr-3',
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
};

export interface TbodyProps extends HTMLAttributes<HTMLTableSectionElement> {
  className?: string;
  children: ReactNode;
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
          'border-b border-gray-alpha-3',
          // Smooth hover transition
          'transition-colors duration-normal ease-out-custom',
          'hover:bg-gray-1',
          // Focus state
          'focus:ring-focus/50 focus:bg-gray-1 focus:ring-1 focus:outline-hidden focus:ring-inset',
          selected && 'bg-gray-2',
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
