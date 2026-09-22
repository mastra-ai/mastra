import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '@/lib/utils';

export type PageHeaderTitleSize = 'sm' | 'md' | 'lg' | 'xl' | 'smaller' | 'default';

export interface PageHeaderTitleProps extends ComponentPropsWithoutRef<'h1'> {
  isLoading?: boolean;
  size?: PageHeaderTitleSize;
}

const titleSizeClasses: Record<PageHeaderTitleSize, string> = {
  sm: 'text-header-sm',
  md: 'text-header-md',
  lg: 'text-header-lg',
  xl: 'text-header-xl',
  smaller: 'text-header-sm',
  default: 'text-header-md',
};

export function PageHeaderTitle({ children, className, isLoading, size = 'md', ...props }: PageHeaderTitleProps) {
  return (
    <h1
      data-slot="page-header-title"
      className={cn(
        'col-start-[title] row-start-1 flex min-w-0 items-center gap-2 self-start font-medium text-muted-foreground [&>svg]:size-[1.25em] [&>svg]:opacity-50',
        titleSizeClasses[size],
        isLoading && 'w-60 max-w-[50%] animate-pulse rounded-md bg-surface4',
        className,
      )}
      {...props}
    >
      {isLoading ? <>&nbsp;</> : children}
    </h1>
  );
}
