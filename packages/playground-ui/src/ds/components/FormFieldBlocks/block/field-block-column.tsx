import '../../../../../new-theme.css';
import { cn } from '@/lib/utils';

export type FieldBlockColumnProps = {
  children: React.ReactNode;
  className?: string;
};

export function FieldBlockColumn({ children, className }: FieldBlockColumnProps) {
  return <div className={cn('new-theme grid gap-2 text-foreground', className)}>{children}</div>;
}
