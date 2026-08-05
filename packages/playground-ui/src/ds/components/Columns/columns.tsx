import { cn } from '@/lib/utils';

export type ColumnsProps = {
  children: React.ReactNode;
  className?: string;
};

export function Columns({ children, className }: ColumnsProps) {
  return <div className={cn(`grid size-full grid-cols-1 overflow-y-auto`, className)}>{children}</div>;
}
