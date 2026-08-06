import { cn } from '@/lib/utils';

export type ColumnToolbarProps = {
  children?: React.ReactNode;
  className?: string;
};

export function ColumnToolbar({ children, className }: ColumnToolbarProps) {
  return (
    <div className={cn(`flex w-full flex-wrap items-center justify-between gap-4 gap-x-6`, className)}>{children}</div>
  );
}
