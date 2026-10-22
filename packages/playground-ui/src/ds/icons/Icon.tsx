import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { iconSizeClasses } from './icon-size-classes';
import type { IconSize } from './icon-size-classes';

export type { IconSize } from './icon-size-classes';

export interface IconProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  className?: string;
  size?: IconSize;
}

export const Icon = ({ children, className, size = 'md', ...props }: IconProps) => {
  return (
    <span data-slot="icon" className={cn('block', iconSizeClasses[size], className)} {...props}>
      {children}
    </span>
  );
};
