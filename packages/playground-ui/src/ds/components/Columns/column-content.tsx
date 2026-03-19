import { cn } from '@/index';

export type ColumnProps = {
  children?: React.ReactNode;
  className?: string;
};

export function ColumnContent({ children, className }: ColumnProps) {
  return <div className={cn(`grid overflow-y-auto gap-8 content-start`, className)}>{children}</div>;
}
