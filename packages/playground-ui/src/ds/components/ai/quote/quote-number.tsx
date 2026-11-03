import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '@/lib/utils';

/**
 * An annotation's number in a comment bubble, the same in the transcript and in the composer's
 * list. The square bottom-left corner is the bubble's tail: in the transcript it touches the end of
 * the passage it belongs to.
 */
export const quoteBubbleStyle =
  'inline-flex h-4.5 min-w-4.5 shrink-0 items-center justify-center gap-0.5 rounded-full rounded-bl-xs bg-info-indicator px-1.25 text-column leading-none text-background tabular-nums';

export function QuoteNumber({ className, ...props }: ComponentPropsWithoutRef<'span'>) {
  return <span data-slot="quote-number" className={cn(quoteBubbleStyle, className)} {...props} />;
}
