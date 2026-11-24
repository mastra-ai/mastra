import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export type LogStreamFrameProps = ComponentProps<'div'>;

export function LogStreamFrame({ className, ...props }: LogStreamFrameProps) {
  return (
    <div
      className={cn(
        '@container relative min-h-0 overflow-hidden rounded-lg bg-row',
        "after:pointer-events-none after:absolute after:inset-0 after:z-30 after:rounded-[inherit] after:shadow-rim after:content-['']",
        className,
      )}
      {...props}
    />
  );
}
