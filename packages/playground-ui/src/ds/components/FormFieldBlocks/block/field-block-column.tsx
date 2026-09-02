import { cn } from '@/lib/utils';

export type FieldBlockColumnProps = {
  children: React.ReactNode;
  className?: string;
};

export function FieldBlockColumn({ children, className }: FieldBlockColumnProps) {
  return <div className={cn('grid gap-2 text-gray-10', className)}>{children}</div>;
}
