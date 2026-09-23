import { cn } from '@/lib/utils';

export type ColumnProps = {
  children: React.ReactNode;
  className?: string;
};

export function ColumnRoot({ children, className }: ColumnProps) {
  return (
    <div className="flex w-full overflow-y-auto">
      <div className={cn(`grid w-full content-start gap-4 overflow-y-auto`, className)}>{children}</div>
    </div>
  );
}
