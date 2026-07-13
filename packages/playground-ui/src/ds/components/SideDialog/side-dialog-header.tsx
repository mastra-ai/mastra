import { cn } from '@/lib/utils';

export type SideDialogHeaderProps = {
  children?: React.ReactNode;
  className?: string;
};

export function SideDialogHeader({ children, className }: SideDialogHeaderProps) {
  return <div className={cn('flex items-center justify-between pb-4', className)}>{children}</div>;
}
