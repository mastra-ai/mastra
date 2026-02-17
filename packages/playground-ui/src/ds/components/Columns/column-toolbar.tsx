import { cn } from '@/index';

export type ColumnToolbarProps = {
  children?: React.ReactNode;
  className?: string;
};

export function ColumnToolbar({ children, className }: ColumnToolbarProps) {
  return <div className={cn(`flex items-center justify-between w-full`, className)}>{children}</div>;
}
