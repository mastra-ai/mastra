import { DrawerInteractive } from '@/ds/components/Drawer';
import { cn } from '@/lib/utils';

export type SideDialogContentProps = {
  children?: React.ReactNode;
  className?: string;
};

export function SideDialogContent({ children, className }: SideDialogContentProps) {
  return (
    <DrawerInteractive
      render={
        <div className={cn('grid content-start gap-6 overflow-y-scroll p-6 pb-8 pl-9', className)}>{children}</div>
      }
    />
  );
}
