import { Children, type ComponentProps } from 'react';

import { AvatarSizeContext, type AvatarSize } from './avatar-size';
import { cn } from '@/lib/utils';

export type AvatarGroupProps = ComponentProps<'div'> & {
  size?: AvatarSize;
};

// The notch around the avatar on top: a gap, then a soft edge. Small avatars
// get a thinner one so it doesn't swallow the avatar behind.
const thinNotch = '[--avatar-group-gap:1px] [--avatar-group-edge:0.5px]';
const notch = '[--avatar-group-gap:--spacing(0.5)] [--avatar-group-edge:1px]';

const groupSizeClasses: Record<AvatarSize, string> = {
  xs: `[--avatar-group-size:var(--spacing-icon-xs)] ${thinNotch}`,
  inline: `[--avatar-group-size:var(--spacing-icon-md)] ${thinNotch}`,
  sm: `[--avatar-group-size:var(--spacing-avatar-sm)] ${notch}`,
  md: `[--avatar-group-size:var(--spacing-avatar-md)] ${notch}`,
  lg: `[--avatar-group-size:var(--spacing-avatar-lg)] ${notch}`,
  control: `[--avatar-group-size:var(--spacing-control-md)] ${notch}`,
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
