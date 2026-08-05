import { cn } from '@/lib/utils';

export type ColumnProps = {
  children?: React.ReactNode;
  className?: string;
};

export function ColumnContent({ children, className }: ColumnProps) {
  return <div className={cn(`grid content-start gap-8 overflow-y-auto`, className)}>{children}</div>;
}
