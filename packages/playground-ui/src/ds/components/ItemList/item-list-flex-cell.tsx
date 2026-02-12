import { cn } from '@/lib/utils';

export type ItemListTextCellProps = {
  children: React.ReactNode;
  isLoading?: boolean;
  className?: string;
};

export function ItemListFlexCell({ children, isLoading, className }: ItemListTextCellProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {isLoading ? (
        <div className="bg-surface4 rounded-md animate-pulse text-transparent h-[1rem] select-none"></div>
      ) : (
        children
      )}
    </div>
  );
}
