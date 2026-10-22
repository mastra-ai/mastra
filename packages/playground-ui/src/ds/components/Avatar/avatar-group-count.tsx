import { useContext } from 'react';
import type { ComponentProps } from 'react';

import { cn } from '../../../lib/utils';
import { AvatarSizeContext, avatarIconClasses, avatarSizeClasses, avatarTextClasses } from './avatar-size';

export type AvatarGroupCountProps = ComponentProps<'div'>;

export function AvatarGroupCount({ className, ...props }: AvatarGroupCountProps) {
  const size = useContext(AvatarSizeContext) ?? 'sm';

  return (
    <div
      {...props}
      data-slot="avatar-group-count"
      data-size={size}
      className={cn(
        'relative flex shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground tabular-nums',
        'after:pointer-events-none after:absolute after:inset-0 after:rounded-full after:border after:border-border',
        avatarSizeClasses[size],
        avatarTextClasses[size],
        avatarIconClasses[size],
        className,
      )}
    />
  );
}
