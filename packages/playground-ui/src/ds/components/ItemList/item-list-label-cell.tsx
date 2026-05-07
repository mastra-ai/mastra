import { cn } from '@/lib/utils';

export type ItemListLabelCellProps = {
  children: React.ReactNode;
  className?: string;
};

export function ItemListLabelCell({ children, className }: ItemListLabelCellProps) {
  return (
    <label className={cn('flex w-14 h-full justify-center items-center hover:bg-surface5 rounded-lg', className)}>
      {children}
    </label>
  );
}
