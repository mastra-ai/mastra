import { cn } from '@/lib/utils';

export type FieldBlocksLayoutColumnProps = {
  children: React.ReactNode;
  className?: string;
};

export function FieldBlocksLayoutColumn({ children, className }: FieldBlocksLayoutColumnProps) {
  return <div className={cn('grid content-start gap-6', className)}>{children}</div>;
}
