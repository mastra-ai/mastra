import { cn } from '@/lib/utils';

export type SideDialogTopProps = {
  children?: React.ReactNode;
  className?: string;
};

export function SideDialogTop({ children, className }: SideDialogTopProps) {
  return (
    <div
      className={cn(
        `flex h-[3.5rem] items-center text-neutral5 text-ui-md pl-[1.5rem] relative gap-[1rem]`,
        '[&:after]:content-[""] [&:after]:absolute [&:after]:left-[1.5rem] [&:after]:right-[1.5rem] [&:after]:bottom-0 [&:after]:border-b [&:after]:border-border1',
        className,
      )}
    >
      {children}
    </div>
  );
}
