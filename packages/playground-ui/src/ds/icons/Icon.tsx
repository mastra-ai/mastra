import type { HTMLAttributes, ReactNode } from 'react';
import { iconSizeClasses, type IconSize } from './icon-size-classes';
import { cn } from '@/lib/utils';

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
