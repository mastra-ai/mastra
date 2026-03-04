import { cn } from '@/index';
import { ScrollArea } from '@/ds/components/ScrollArea';

export type ColumnProps = {
  children?: React.ReactNode;
  className?: string;
};

export function ColumnContent({ children, className }: ColumnProps) {
  return (
    <ScrollArea permanentScrollbar>
      <div className={cn(`grid gap-8 content-start`, className)}>{children}</div>
    </ScrollArea>
  );
}
