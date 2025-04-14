import clsx from 'clsx';
import React from 'react';

import { Icon } from '../../icons/Icon';
import { Txt } from '../Txt';

import { formatDateCell } from './utils';

export interface CellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  className?: string;
  children: React.ReactNode;
}

export const Cell = ({ className, children, ...props }: CellProps) => {
  return (
    <td className={clsx('text-icon5 first:pl-5 last:pr-5', className)} {...props}>
      <div className={clsx('flex h-full w-full shrink-0 items-center')}>{children}</div>
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

export const UnitCell = ({ className, children, unit }: CellProps & { unit: string }) => {
  return (
    <Cell className={className}>
      <div className="flex min-w-0 items-center">
        <Txt as="span" variant="ui-md" className="shrink-0">
          {children}
        </Txt>
        <Txt as="span" variant="ui-sm" className="text-icon3 w-full truncate">
          {unit}
        </Txt>
      </div>
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
        <Txt as="span" variant="ui-sm" className="text-icon3">
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
  icon: React.ReactNode;
  meta?: React.ReactNode;
}

export const EntryCell = ({ name, description, icon, meta, ...props }: EntryCellProps) => {
  return (
    <Cell {...props}>
      <div className="flex items-center gap-[14px]">
        <Icon size="lg" className="text-icon5">
          {icon}
        </Icon>

        <div className="flex flex-col gap-0">
          <Txt as="span" variant="ui-md" className="text-icon6 font-medium !leading-tight">
            {name}
          </Txt>
          {description && (
            <Txt as="span" variant="ui-xs" className="text-icon3 w-full max-w-[300px] truncate !leading-tight">
              {description}
            </Txt>
          )}
        </div>
        {meta}
      </div>
    </Cell>
  );
};
