import { cn } from '@/lib/utils';

type DialogMode = 'view' | 'create' | 'edit' | 'delete' | 'save';

export type SideDialogHeaderProps = {
  children?: React.ReactNode;
  className?: string;
};

export function SideDialogHeader({ children, className }: SideDialogHeaderProps) {
  return (
    <div
      className={cn(
        'flex justify-between items-center',
        '[&>h2]:text-icon4 [&>h2]:text-[1.125rem] [&>h2]:font-semibold flex ',
        className,
      )}
    >
      {children}
    </div>
  );
}
