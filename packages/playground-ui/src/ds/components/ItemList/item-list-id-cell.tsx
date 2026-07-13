import { cn } from '@/lib/utils';

export type ItemListIdCellProps = {
  id: string;
  className?: string;
  isShortened?: boolean;
};

export function ItemListIdCell({ id, className, isShortened = true }: ItemListIdCellProps) {
  const displayId = isShortened ? id.slice(0, 8) : id;
  return <div className={cn('truncate py-[0.6rem] text-ui-md text-neutral2', className)}>{displayId}</div>;
}
