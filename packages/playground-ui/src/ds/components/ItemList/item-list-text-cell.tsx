import { cn } from '@/lib/utils';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

export type ItemListTextCellProps = {
  children: React.ReactNode;
  isLoading?: boolean;
};

export function ItemListTextCell({ children, isLoading }: ItemListTextCellProps) {
  return (
    <div className="text-neutral4 text-ui-md truncate ">
      {isLoading ? (
        <div className="bg-surface4 rounded-md animate-pulse text-transparent h-[1rem] select-none"></div>
      ) : (
        children
      )}
    </div>
  );
}
