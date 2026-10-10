import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type CompositeAvatarProps = ComponentProps<'span'> & {
  badge: ReactNode;
};

export function CompositeAvatar({ badge, children, className, ...props }: CompositeAvatarProps) {
  return (
    <span {...props} data-slot="composite-avatar" className={cn('relative inline-flex shrink-0 pr-1 pb-1', className)}>
      {children}
      <span
        data-slot="composite-avatar-badge"
        className="absolute right-0 bottom-0 flex items-center justify-center rounded-full bg-card p-0.5"
      >
        {badge}
      </span>
    </span>
  );
}
