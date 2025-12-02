import { cn } from '@/lib/utils';

export type SideDialogTopProps = {
  children?: React.ReactNode;
  withTopSeparator?: boolean;
  className?: string;
};

export function SideDialogTop({ children, withTopSeparator, className }: SideDialogTopProps) {
  return (
    <div
      className={cn(
        `flex h-[3.5rem] items-center text-icon5 text-[.875rem] pl-[1.5rem] relative gap-[1rem]`,
        '[&:after]:content-[""] [&:after]:absolute [&:after]:left-[1.5rem] [&:after]:right-[1.5rem] [&:after]:bottom-0 [&:after]:border-b [&:after]:border-border1',
        {
          '[&:before]:content-[""] [&:before]:absolute [&:before]:left-[1.5rem] [&:before]:right-[1.5rem] [&:before]:top-0 [&:before]:border-t [&:before]:border-border1':
            withTopSeparator,
        },
        className,
      )}
    >
      {children}
    </div>
  );
}
