import { cn } from '@/lib/utils';

export type ItemListLabelCellProps = {
  children: React.ReactNode;
  className?: string;
};

export function ItemListLabelCell({ children, className }: ItemListLabelCellProps) {
  return (
    <label className={cn('flex h-full w-14 items-center justify-center rounded-lg hover:bg-surface-active', className)}>
      {children}
    </label>
  );
}
