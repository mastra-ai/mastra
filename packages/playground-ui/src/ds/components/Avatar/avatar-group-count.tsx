import { useContext, type ComponentProps } from 'react';

import { AvatarSizeContext, avatarIconClasses, avatarSizeClasses, avatarTextClasses } from './avatar-size';
import { cn } from '@/lib/utils';

export type AvatarGroupCountProps = ComponentProps<'div'>;

export function AvatarGroupCount({ className, ...props }: AvatarGroupCountProps) {
  const size = useContext(AvatarSizeContext) ?? 'sm';

  return (
    <div
      {...props}
      data-slot="avatar-group-count"
      data-size={size}
      className={cn(
        'relative flex shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground tabular-nums ring-2 ring-card',
        avatarSizeClasses[size],
        avatarTextClasses[size],
        avatarIconClasses[size],
        className,
      )}
    />
  );
}
