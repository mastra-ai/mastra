import React from 'react';

import { Icon } from '../../icons/Icon';
import { Txt } from '../Txt';
import { formatDateCell } from './utils';
import { cn } from '@/lib/utils';

export interface CellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  className?: string;
  children: React.ReactNode;
}

export const Cell = ({ className, children, ...props }: CellProps) => {
  return (
    <td className={cn('text-foreground first:pl-3 last:pr-3', className)} {...props}>
      <div className={cn('flex size-full shrink-0 items-center')}>{children}</div>
    </td>
  );
};

export const TxtCell = ({ className, children }: CellProps) => {
  return (
    <Cell className={className}>
      <Txt as="span" variant="body-sm" className="w-full truncate">
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
        <Txt as="span" variant="caption" className="text-muted-foreground">
          {day}
        </Txt>{' '}
        <Txt as="span" variant="body">
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
      <div className="flex items-center gap-3.5">
        {icon && (
          <Icon size="lg" className="text-foreground">
            {icon}
          </Icon>
        )}

        <div className="flex flex-col gap-0">
          <Txt as="span" variant="body" className="text-foreground">
            {name}
          </Txt>
          {description && (
            <Txt as="span" variant="meta" className="text-muted-foreground w-full max-w-75 truncate pt-1">
              {description}
            </Txt>
          )}
        </div>
        {meta}
      </div>
    </Cell>
  );
};
