import { Children } from 'react';
import type { ComponentProps } from 'react';

import { AvatarSizeContext } from './avatar-size';
import type { AvatarSize } from './avatar-size';
import { cn } from '@/lib/utils';

export type AvatarGroupProps = ComponentProps<'div'> & {
  size?: AvatarSize;
};

const groupSizeClasses: Record<AvatarSize, string> = {
  xs: '[--avatar-group-size:var(--spacing-icon-xs)]',
  sm: '[--avatar-group-size:var(--spacing-avatar-sm)]',
  md: '[--avatar-group-size:var(--spacing-avatar-md)]',
  lg: '[--avatar-group-size:var(--spacing-avatar-lg)]',
  control: '[--avatar-group-size:var(--spacing-control-md)]',
};

const overlapClasses = [
  '*:not-first:ml-[calc(var(--avatar-group-size)/-4)]',
  '*:not-first:[mask-image:radial-gradient(circle_at_calc(var(--avatar-group-size)*-0.25)_50%,transparent_calc(var(--avatar-group-size)/2+--spacing(0.5)),black_calc(var(--avatar-group-size)/2+--spacing(0.75)))]',
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
