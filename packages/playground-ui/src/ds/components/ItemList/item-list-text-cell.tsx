import { cn } from '@/lib/utils';

export type ItemListTextCellProps = {
  children: React.ReactNode;
  isLoading?: boolean;
  className?: string;
};

export function ItemListTextCell({ children, isLoading, className }: ItemListTextCellProps) {
  return (
    <div className={cn('truncate  py-[0.6rem] text-ui-md text-neutral4', className)}>
      {isLoading ? (
        <div className="h-4 animate-pulse rounded-md bg-surface4 text-transparent select-none"></div>
      ) : (
        children
      )}
    </div>
  );
}
