import clsx from 'clsx';
import React from 'react';

import { Icon } from '../../icons/Icon';
import { Txt } from '../Txt';

import { formatDateCell } from './utils';

export interface CellProps {
  className?: string;
  children: React.ReactNode;
}

export const Cell = ({ className, children }: CellProps) => {
  return (
    <td className="text-icon5 first:pl-5 last:pr-5">
      <div className={clsx('flex h-full items-center', className)}>{children}</div>
    </td>
  );
};

export const TxtCell = ({ className, children }: CellProps) => {
  return (
    <Cell className={className}>
      <Txt as="span" variant="ui-md" className="w-full max-w-[330px] truncate">
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
        <Txt as="span" variant="ui-sm" className="text-icon3 w-full max-w-[200px] truncate">
          {unit}
        </Txt>
      </div>
    </Cell>
  );
};

export interface DateTimeCellProps {
  className?: string;
  dateTime: Date;
}

export const DateTimeCell = ({ className, dateTime }: DateTimeCellProps) => {
  const { day, time } = formatDateCell(dateTime);
  return (
    <Cell className={className}>
      <div className="w-28 shrink-0">
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

export interface EntryCellProps {
  className?: string;
  name: React.ReactNode;
  description?: React.ReactNode;
  icon: React.ReactNode;
  meta?: React.ReactNode;
}

export const EntryCell = ({ className, name, description, icon, meta }: EntryCellProps) => {
  return (
    <Cell className={clsx('!gap-[14px]', className)}>
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
    </Cell>
  );
};
