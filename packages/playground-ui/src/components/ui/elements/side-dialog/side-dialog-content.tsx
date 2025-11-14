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
    <div className={cn('p-[1.5rem] pl-[2.25rem] overflow-y-scroll grid gap-[1.5rem] content-start', className)}>
      <div className={cn('grid gap-[1.5rem] mb-[2rem] ')}>{children}</div>
    </div>
  );
}
