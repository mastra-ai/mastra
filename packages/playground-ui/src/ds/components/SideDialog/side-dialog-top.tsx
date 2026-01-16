import { cn } from '@/lib/utils';

export type SideDialogTopProps = {
  children?: React.ReactNode;
  className?: string;
};

export function SideDialogTop({ children, className }: SideDialogTopProps) {
  return (
    <div
      className={cn(
        `flex h-14 items-center text-neutral5 text-ui-md pl-6 relative gap-4`,
        '[&:after]:content-[""] [&:after]:absolute [&:after]:left-6 [&:after]:right-6 [&:after]:bottom-0 [&:after]:border-b [&:after]:border-border1',
        className,
      )}
    >
      {children}
    </div>
  );
}
