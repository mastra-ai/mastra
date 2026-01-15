import React from 'react';

import { Icon } from '../../icons/Icon';
import { Txt } from '../Txt';
import { cn } from '@/lib/utils';

import { formatDateCell } from './utils';

export interface CellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  className?: string;
  children: React.ReactNode;
}

export const Cell = ({ className, children, ...props }: CellProps) => {
  return (
    <td className={cn('text-neutral5 first:pl-3 last:pr-3', className)} {...props}>
      <div className={cn('flex h-full w-full shrink-0 items-center')}>{children}</div>
    </td>
  );
};

export const TxtCell = ({ className, children }: CellProps) => {
  return (
    <Cell className={className}>
      <Txt as="span" variant="ui-md" className="w-full truncate">
        {children}
      </Txt>
    </Cell>
  );
};

export interface DateTimeCellProps extends Omit<CellProps, 'children'> {
  dateTime: Date;
}

export const DateTimeCell = ({ dateTime, ...props }: DateTimeCellProps) => {
  const { day, time } = formatDateCell(dateTime);

  return (
    <Cell {...props}>
      <div className="shrink-0">
        <Txt as="span" variant="ui-sm" className="text-neutral3">
          {day}
        </Txt>{' '}
        <Txt as="span" variant="ui-md">
          {time}
        </Txt>
      </div>
    </Cell>
  );
};

export interface EntryCellProps extends Omit<CellProps, 'children'> {
  name: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  meta?: React.ReactNode;
}

export const EntryCell = ({ name, description, icon, meta, ...props }: EntryCellProps) => {
  return (
    <Cell {...props}>
      <div className="flex items-center gap-[14px]">
        {icon && (
          <Icon size="lg" className="text-neutral5">
            {icon}
          </Icon>
        )}

        <div className="flex flex-col gap-0">
          <Txt as="span" variant="ui-md" className="text-neutral6 !leading-tight">
            {name}
          </Txt>
          {description && (
            <Txt as="span" variant="ui-xs" className="text-neutral3 w-full max-w-[300px] truncate !leading-tight pt-1">
              {description}
            </Txt>
          )}
        </div>
        {meta}
      </div>
    </Cell>
  );
};
