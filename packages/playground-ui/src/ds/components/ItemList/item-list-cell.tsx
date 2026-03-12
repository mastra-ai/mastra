import { cn } from '@/lib/utils';

export type ItemListCellProps = {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

export function ItemListCell({ children, className, style }: ItemListCellProps) {
  return (
    <div className={cn('', className)} style={style}>
      {children}
    </div>
  );
}
