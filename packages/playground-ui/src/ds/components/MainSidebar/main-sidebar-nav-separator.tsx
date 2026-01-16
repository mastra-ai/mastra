import { cn } from '@/lib/utils';

export type MainSidebarNavSeparatorProps = {
  className?: string;
};
export function MainSidebarNavSeparator({ className }: MainSidebarNavSeparatorProps) {
  return (
    <div
      className={cn(
        'min-h-5 relative',
        '[&:after]:content-[""] [&:after]:block [&:after]:absolute [&:after]:h-0 [&:after]:border-border1 [&:after]:border-t [&:after]:top-1/2 [&:after]:left-3 [&:after]:right-3',
        className,
      )}
    ></div>
  );
}
