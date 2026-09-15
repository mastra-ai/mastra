import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

export type MainSidebarNavSeparatorProps = ComponentPropsWithoutRef<'div'>;

export function MainSidebarNavSeparator({ className, ...props }: MainSidebarNavSeparatorProps) {
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      className={cn(
        'relative min-h-5',
        '[&:after]:absolute [&:after]:inset-x-3 [&:after]:top-1/2 [&:after]:block [&:after]:h-0 [&:after]:border-t [&:after]:border-border1 [&:after]:content-[""]',
        className,
      )}
      {...props}
    />
  );
}
