import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '@/lib/utils';

type DivProps = ComponentPropsWithoutRef<'div'>;

/** One toolbar line: a start group and an end group pushed apart, wrapping on narrow viewports. */
export function ActionRowRoot({ className, ...props }: DivProps) {
  return (
    <div
      data-slot="action-row"
      className={cn('flex min-h-control-md flex-wrap items-center justify-between gap-2', className)}
      {...props}
    />
  );
}

/** Actions positioned on the left. Grows to fill the line; keeps a floor so the end group wraps under it instead of squeezing it. */
export function ActionRowStart({ className, ...props }: DivProps) {
  return (
    <div
      data-slot="action-row-start"
      className={cn('flex min-w-64 flex-1 flex-wrap items-center gap-2', className)}
      {...props}
    />
  );
}

/** Actions positioned on the right. Never shrinks; wraps under the start group when needed. */
export function ActionRowEnd({ className, ...props }: DivProps) {
  return (
    <div data-slot="action-row-end" className={cn('ml-auto flex shrink-0 items-center gap-2', className)} {...props} />
  );
}
