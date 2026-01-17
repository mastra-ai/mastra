import { cn } from '@/lib/utils';

export type SideDialogContentProps = {
  children?: React.ReactNode;
  className?: string;
  isCentered?: boolean;
  isFullHeight?: boolean;
  variant?: 'default' | 'confirmation';
};

export function SideDialogContent({ children, className }: SideDialogContentProps) {
  return (
    <div className={cn('p-6 pl-9 overflow-y-scroll grid gap-6 content-start', className)}>
      <div className={cn('grid gap-6 mb-8')}>{children}</div>
    </div>
  );
}
