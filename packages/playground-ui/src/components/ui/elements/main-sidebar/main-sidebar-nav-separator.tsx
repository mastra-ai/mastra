'use client';

import { cn } from '@/lib/utils';

type MainSidebarNavSeparatorProps = {
  className?: string;
};
export function MainSidebarNavSeparator({ className }: MainSidebarNavSeparatorProps) {
  return (
    <div
      className={cn(
        'min-h-[1.3rem] relative',
        '[&:after]:content-[""] [&:after]:block [&:after]:absolute [&:after]:h-[0px] [&:after]:border-border1 [&:after]:border-t [&:after]:top-[48%] [&:after]:left-[0.75rem] [&:after]:right-[0.75rem]',
        className,
      )}
    ></div>
  );
}
