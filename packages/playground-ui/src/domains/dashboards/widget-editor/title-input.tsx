import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** Reads as a card's title; an outline on hover says it can be renamed. */
export function TitleInput({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      type="text"
      autoComplete="off"
      className={cn(
        // The card title's 20px line, kept by the negative margins so the header doesn't grow.
        '-mx-1.5 -my-1 h-7 w-full min-w-0 rounded-md border border-transparent bg-transparent px-1.5 text-body font-medium text-foreground',
        'transition-colors placeholder:text-placeholder',
        'hover:border-border-strong',
        'focus:border-border-focus focus:outline-none',
        'aria-invalid:border-destructive-indicator',
        className,
      )}
      {...props}
    />
  );
}
