import { cn } from '@/lib/utils';

export type ItemListTextCellProps = {
  children: React.ReactNode;
  className?: string;
};

export function ItemListTextCell({ children, className }: ItemListTextCellProps) {
  return <div className={cn('text-neutral4  py-[0.6rem] text-ui-md truncate', className)}>{children}</div>;
}
