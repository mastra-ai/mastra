import clsx from 'clsx';
import React from 'react';

export interface TableProps {
  className?: string;
  children: React.ReactNode;
  size?: 'default' | 'small';
}

const rowSize = {
  default: '[&>tbody>tr]:h-table-row',
  small: '[&>tbody>tr]:h-table-row-small',
};

export const Table = ({ className, children, size = 'default' }: TableProps) => {
  return <table className={clsx('w-full', rowSize[size], className)}>{children}</table>;
};

export interface TheadProps {
  className?: string;
  children: React.ReactNode;
}

export const Thead = ({ className, children }: TheadProps) => {
  return (
    <thead>
      <tr className={clsx('h-table-header border-b-sm border-border1', className)}>{children}</tr>
    </thead>
  );
};

export interface ThProps {
  className?: string;
  children: React.ReactNode;
}

export const Th = ({ className, children }: ThProps) => {
  return (
    <th
      className={clsx('text-icon3 text-ui-sm h-full text-left font-normal uppercase first:pl-5 last:pr-5', className)}
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
}

export const Row = ({ className, children, selected = false }: RowProps) => {
  return (
    <tr className={clsx('border-b-sm border-border1 hover:bg-surface3', selected && 'bg-surface4', className)}>
      {children}
    </tr>
  );
};
