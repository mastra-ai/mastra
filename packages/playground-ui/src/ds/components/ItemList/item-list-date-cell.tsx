import { cn } from '@/lib/utils';
import { formatDate } from '@/utils/date-format';

export type ItemListDateCellProps = {
  date: Date | string | null;
  className?: string;
  withTime?: boolean;
};

export function ItemListDateCell({ date, className, withTime = false }: ItemListDateCellProps) {
  return (
    <div className={cn('truncate text-body text-placeholder', className)}>
      {formatDate(date, withTime ? 'dateTime' : 'smart')}
    </div>
  );
}
