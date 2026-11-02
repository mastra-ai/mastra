import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** Reads as the dialog's heading; a dashed outline on hover says it can be renamed. */
export function TitleInput({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      type="text"
      autoComplete="off"
      className={cn(
        '-mx-1.5 h-8 w-full min-w-0 rounded-md border border-transparent bg-transparent px-1.5 text-heading text-foreground',
        'transition-colors placeholder:text-placeholder',
        'hover:border-dashed hover:border-border-strong',
        'focus:border-solid focus:border-border-focus focus:outline-none',
        'aria-invalid:border-dashed aria-invalid:border-destructive-indicator',
        className,
      )}
      {...props}
    />
  );
}
