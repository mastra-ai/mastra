import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '@/lib/utils';

/** The square bottom-left corner is the bubble's tail: in the transcript it touches the end of its passage. */
export const annotationBubbleStyle =
  'inline-flex h-4.5 min-w-4.5 shrink-0 items-center justify-center gap-0.5 rounded-full rounded-bl-xs bg-info-indicator px-1.25 text-column leading-none text-background tabular-nums';

export function AnnotationNumber({ className, ...props }: ComponentPropsWithoutRef<'span'>) {
  return <span data-slot="annotation-number" className={cn(annotationBubbleStyle, className)} {...props} />;
}
