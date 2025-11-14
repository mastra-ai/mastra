import { cn } from '@/lib/utils';

type DialogMode = 'view' | 'create' | 'edit' | 'delete' | 'save';

export type SideDialogHeaderProps = {
  children?: React.ReactNode;
  className?: string;
};

export function SideDialogHeader({ children, className }: SideDialogHeaderProps) {
  return <div className={cn('flex justify-between items-center pb-[1rem]', className)}>{children}</div>;
}
