import { cn } from '@/lib/utils';

export type SideDialogContentProps = {
  children?: React.ReactNode;
  className?: string;
  isCentered?: boolean;
  isFullHeight?: boolean;
  variant?: 'default' | 'confirmation';
};

export function SideDialogContent({ children, className }: SideDialogContentProps) {
  return <div className={cn('p-6 pl-9 overflow-y-scroll grid gap-6 content-start pb-8', className)}>{children}</div>;
}
