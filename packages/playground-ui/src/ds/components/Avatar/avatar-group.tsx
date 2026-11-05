import { Children } from 'react';
import type { ComponentProps } from 'react';

import { AvatarSizeContext } from './avatar-size';
import type { AvatarSize } from './avatar-size';
import { cn } from '@/lib/utils';

export type AvatarGroupProps = ComponentProps<'div'> & {
  size?: AvatarSize;
};

// Small avatars get a thinner gap around the avatar on top, so it doesn't
// swallow the avatar behind.
const groupSizeClasses: Record<AvatarSize, string> = {
  xs: '[--avatar-group-size:var(--spacing-icon-xs)] [--avatar-group-gap:1px] [--avatar-group-edge:0.5px]',
  inline: '[--avatar-group-size:var(--spacing-icon-md)] [--avatar-group-gap:1px] [--avatar-group-edge:0.5px]',
  sm: '[--avatar-group-size:var(--spacing-avatar-sm)] [--avatar-group-gap:--spacing(0.5)] [--avatar-group-edge:1px]',
  md: '[--avatar-group-size:var(--spacing-avatar-md)] [--avatar-group-gap:--spacing(0.5)] [--avatar-group-edge:1px]',
  lg: '[--avatar-group-size:var(--spacing-avatar-lg)] [--avatar-group-gap:--spacing(0.5)] [--avatar-group-edge:1px]',
  control:
    '[--avatar-group-size:var(--spacing-control-md)] [--avatar-group-gap:--spacing(0.5)] [--avatar-group-edge:1px]',
};

const overlapClasses = [
  '*:not-first:ml-[calc(var(--avatar-group-size)/-4)]',
  '*:not-first:[mask-image:radial-gradient(circle_at_calc(var(--avatar-group-size)*-0.25)_50%,transparent_calc(var(--avatar-group-size)/2+var(--avatar-group-gap)),black_calc(var(--avatar-group-size)/2+var(--avatar-group-gap)+var(--avatar-group-edge)))]',
];

export function AvatarGroup({ size = 'sm', className, children, ...props }: AvatarGroupProps) {
  const items = Children.toArray(children);

  return (
    <AvatarSizeContext.Provider value={size}>
      <div
        {...props}
        data-slot="avatar-group"
        className={cn('flex items-center', groupSizeClasses[size], overlapClasses, className)}
      >
        {items.map((item, index) => (
          <div key={index} data-slot="avatar-group-item" className="flex" style={{ zIndex: items.length - index }}>
            {item}
          </div>
        ))}
      </div>
    </AvatarSizeContext.Provider>
  );
}
