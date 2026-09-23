import { cn } from '@/lib/utils';

export type SideDialogTopProps = {
  children?: React.ReactNode;
  className?: string;
};

export function SideDialogTop({ children, className }: SideDialogTopProps) {
  return (
    <div
      className={cn(
        `relative flex h-11 items-center gap-3 pl-4 text-body text-foreground`,
        '[&:after]:absolute [&:after]:inset-x-6 [&:after]:bottom-0 [&:after]:border-b [&:after]:border-border [&:after]:content-[""]',
        className,
      )}
    >
      {children}
    </div>
  );
}
