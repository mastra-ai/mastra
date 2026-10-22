import { cn } from '../../../lib/utils';
import { DrawerInteractive } from '../Drawer';

export type SideDialogContentProps = {
  children?: React.ReactNode;
  className?: string;
};

export function SideDialogContent({ children, className }: SideDialogContentProps) {
  return (
    <DrawerInteractive
      render={
        <div className={cn('grid content-start gap-4 overflow-y-scroll p-4 pb-5 pl-5', className)}>{children}</div>
      }
    />
  );
}
