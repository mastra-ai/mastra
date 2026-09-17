import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function ComposerStatusLine({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      aria-label="Session status line"
      className={cn('text-icon3 flex h-fit shrink-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-ui-sm', className)}
      {...props}
    />
  );
}
