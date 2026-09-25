import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '@/lib/utils';

export type PageHeaderEyebrowProps = ComponentPropsWithoutRef<'div'>;

export function PageHeaderEyebrow({ className, ...props }: PageHeaderEyebrowProps) {
  return (
    <div
      data-slot="page-header-eyebrow"
      className={cn(
        'flex min-w-0 items-center text-caption text-muted-foreground',
        '[&_a]:inline-flex [&_a]:items-center [&_a]:gap-1 [&_a]:rounded-sm [&_a]:transition-colors [&_a:hover]:text-foreground',
        '[&_svg]:size-icon-sm',
        className,
      )}
      {...props}
    />
  );
}
