import { cn } from '@/lib/utils';

export type ItemListTextCellProps = {
  children: React.ReactNode;
  isLoading?: boolean;
  className?: string;
};

export function ItemListTextCell({ children, isLoading, className }: ItemListTextCellProps) {
  return (
    <div className={cn('text-neutral4  py-[0.6rem] text-ui-md truncate', className)}>
      {isLoading ? (
        <div className="bg-surface4 rounded-md animate-pulse text-transparent h-[1rem] select-none"></div>
      ) : (
        children
      )}
    </div>
  );
}
