import { cn } from '@/lib/utils';

export type SideDialogTopProps = {
  children?: React.ReactNode;
  className?: string;
};

export function SideDialogTop({ children, className }: SideDialogTopProps) {
  return (
    <div
      className={cn(
        `text-ui-md text-neutral5 relative flex h-11 items-center gap-3 pl-4`,
        '[&:after]:absolute [&:after]:inset-x-6 [&:after]:bottom-0 [&:after]:border-b [&:after]:border-border1 [&:after]:content-[""]',
        className,
      )}
    >
      {children}
    </div>
  );
}
