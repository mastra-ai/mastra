import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

export type MainSidebarNavSeparatorProps = ComponentPropsWithoutRef<'div'>;

export function MainSidebarNavSeparator({ className, ...props }: MainSidebarNavSeparatorProps) {
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      className={cn(
        'min-h-5 relative',
        '[&:after]:content-[""] [&:after]:block [&:after]:absolute [&:after]:h-0 [&:after]:border-border1 [&:after]:border-t [&:after]:top-1/2 [&:after]:left-3 [&:after]:right-3',
        className,
      )}
      {...props}
    />
  );
}
