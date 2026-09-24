import { cn } from '@/lib/utils';
import { formatDate } from '@/utils/date-format';
import type { DatePreset } from '@/utils/date-format';

export type ItemListDateCellProps = {
  date: Date | string | null;
  className?: string;
  preset?: DatePreset;
};

export function ItemListDateCell({ date, className, preset = 'date' }: ItemListDateCellProps) {
  return <div className={cn('truncate text-body text-placeholder', className)}>{formatDate(date, preset)}</div>;
}
