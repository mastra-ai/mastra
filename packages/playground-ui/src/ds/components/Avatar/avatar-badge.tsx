import { useContext } from 'react';
import type { ComponentProps } from 'react';

import { AvatarSizeContext } from './avatar-size';
import type { AvatarSize } from './avatar-size';
import { cn } from '@/lib/utils';

export type AvatarBadgeTone = 'neutral' | 'success' | 'warning' | 'destructive' | 'info';

export type AvatarBadgeProps = ComponentProps<'span'> & {
  tone?: AvatarBadgeTone;
};

const toneClasses: Record<AvatarBadgeTone, string> = {
  neutral: 'bg-fill-inverse text-background',
  success: 'bg-success-indicator text-background',
  warning: 'bg-warning-indicator text-background',
  destructive: 'bg-destructive-indicator text-background',
  info: 'bg-info-indicator text-background',
};

const badgeSizeClasses: Record<AvatarSize, string> = {
  xs: 'min-h-1.5 min-w-1.5 [&>svg]:hidden',
  inline: 'min-h-1.5 min-w-1.5 [&>svg]:hidden',
  sm: 'min-h-2 min-w-2 [&>svg]:hidden',
  md: 'min-h-2.5 min-w-2.5 [&>svg]:size-icon-xs',
  lg: 'min-h-3 min-w-3 [&>svg]:size-icon-xs',
  control: 'min-h-2.5 min-w-2.5 [&>svg]:size-icon-xs',
};

export function AvatarBadge({ tone, className, children, ...props }: AvatarBadgeProps) {
  const size = useContext(AvatarSizeContext) ?? 'sm';

  return (
    <span
      {...props}
      data-slot="avatar-badge"
      className={cn(
        'absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full ring-2 ring-card select-none',
        '[&>[data-slot=avatar]]:border-0 [&>[data-slot=avatar]]:after:hidden',
        'after:pointer-events-none after:absolute after:inset-0 after:rounded-full after:shadow-inset',
        tone ? toneClasses[tone] : 'bg-card text-foreground',
        badgeSizeClasses[size],
        className,
      )}
    >
      <AvatarSizeContext.Provider value="xs">{children}</AvatarSizeContext.Provider>
    </span>
  );
}
