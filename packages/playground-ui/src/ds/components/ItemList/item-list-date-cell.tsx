import { cn } from '@/lib/utils';
import { isThisYear } from 'date-fns';
import { format } from 'date-fns/format';
import { isToday } from 'date-fns/isToday';

export type ItemListDateCellProps = {
  date: Date | string | null;
  className?: string;
  withTime?: boolean;
};

export function ItemListDateCell({ date, className, withTime = false }: ItemListDateCellProps) {
  const isThisYearDate = date ? isThisYear(new Date(date)) : false;

  const displayDayAndMonth = date ? (isToday(new Date(date)) ? 'Today' : format(new Date(date), 'MMM dd')) : '';
  const displayYear = date && !isThisYearDate ? format(new Date(date), 'yyyy') : '';
  const displayTime = date && withTime ? `${format(new Date(date), "'at' h:mm aaa")}` : '';

  return (
    <div className={cn('text-neutral2 text-ui-md truncate', className)}>
      {displayDayAndMonth} {displayYear} {displayTime}
    </div>
  );
}
