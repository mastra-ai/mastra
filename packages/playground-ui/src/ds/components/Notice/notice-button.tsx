import type { ComponentProps } from 'react';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export function NoticeButton({ className, type = 'button', ...props }: ComponentProps<'button'>) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex min-w-0 cursor-pointer items-center gap-1.5 rounded-xs text-label text-foreground',
        'underline decoration-foreground/40 underline-offset-4 hover:decoration-foreground',
        transitions.colors,
        'outline-offset-2 focus-visible:outline-2 focus-visible:outline-border-focus',
        'disabled:cursor-not-allowed disabled:text-muted-foreground [&>svg]:size-icon-sm [&>svg]:shrink-0',
        className,
      )}
      {...props}
    />
  );
}
