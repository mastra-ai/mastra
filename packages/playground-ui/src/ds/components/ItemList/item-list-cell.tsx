import { cn } from '@/lib/utils';

export type ItemListTextCellProps = {
  children: React.ReactNode;
  className?: string;
};

export function ItemListCell({ children, className }: ItemListTextCellProps) {
  return <div className={cn('', className)}>{children}</div>;
}
