import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '@/lib/utils';

/** An annotation's number, the same in the transcript and in the composer's list. */
export function QuoteNumber({ className, ...props }: ComponentPropsWithoutRef<'span'>) {
  return (
    <span
      data-slot="quote-number"
      className={cn(
        'inline-grid size-5 shrink-0 place-items-center rounded-full bg-info-indicator text-column text-background tabular-nums',
        className,
      )}
      {...props}
    />
  );
}
