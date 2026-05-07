import { cn } from '@/lib/utils';

export type ItemListHeaderColProps = {
  children?: React.ReactNode;
  className?: string;
};

export function ItemListHeaderCol({ children, className }: ItemListHeaderColProps) {
  return <span className={cn('py-3', className)}>{children}</span>;
}
