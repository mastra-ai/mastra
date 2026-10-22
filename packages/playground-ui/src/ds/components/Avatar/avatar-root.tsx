import { Avatar as BaseAvatar } from '@base-ui/react/avatar';
import { useContext } from 'react';

import { cn } from '../../../lib/utils';
import { AvatarSizeContext, avatarSizeClasses } from './avatar-size';
import type { AvatarSize } from './avatar-size';

export type AvatarRootProps = Omit<BaseAvatar.Root.Props, 'className'> & {
  size?: AvatarSize;
  className?: string;
  name?: never;
};

export function AvatarRoot({ size, className, ...props }: AvatarRootProps) {
  const contextSize = useContext(AvatarSizeContext);
  const resolvedSize = size ?? contextSize ?? 'sm';

  return (
    <AvatarSizeContext.Provider value={resolvedSize}>
      <BaseAvatar.Root
        {...props}
        data-slot="avatar"
        data-size={resolvedSize}
        className={cn(
          'relative inline-flex shrink-0 rounded-full select-none',
          'after:pointer-events-none after:absolute after:inset-0 after:rounded-full after:border after:border-border',
          avatarSizeClasses[resolvedSize],
          className,
        )}
      />
    </AvatarSizeContext.Provider>
  );
}
