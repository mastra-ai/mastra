import { cn } from '@/lib/utils';

export type FieldBlocksLayoutColumnProps = {
  children: React.ReactNode;
  className?: string;
};

export function FieldBlocksLayoutColumn({ children, className }: FieldBlocksLayoutColumnProps) {
  return <div className={cn('grid gap-6 content-start', className)}>{children}</div>;
}
