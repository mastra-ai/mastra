import { Avatar as BaseAvatar } from '@base-ui/react/avatar';
import { useContext } from 'react';

import { AvatarSizeContext, avatarIconClasses, avatarTextClasses } from './avatar-size';
import { cn } from '@/lib/utils';

export type AvatarFallbackProps = Omit<BaseAvatar.Fallback.Props, 'className'> & {
  className?: string;
};

export function AvatarFallback({ className, ...props }: AvatarFallbackProps) {
  const size = useContext(AvatarSizeContext) ?? 'sm';

  return (
    <BaseAvatar.Fallback
      {...props}
      data-slot="avatar-fallback"
      className={cn(
        'flex size-full items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground',
        avatarTextClasses[size],
        avatarIconClasses[size],
        className,
      )}
    />
  );
}
