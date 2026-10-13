import type { ComponentProps } from 'react';

import { AvatarSizeContext, type AvatarSize } from './avatar-size';
import { cn } from '@/lib/utils';

export type AvatarGroupProps = ComponentProps<'div'> & {
  size?: AvatarSize;
};

export function AvatarGroup({ size, className, ...props }: AvatarGroupProps) {
  return (
    <AvatarSizeContext.Provider value={size}>
      <div
        {...props}
        data-slot="avatar-group"
        className={cn('flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-card', className)}
      />
    </AvatarSizeContext.Provider>
  );
}
