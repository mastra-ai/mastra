import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type IconSize = 'xs' | 'sm' | 'md' | 'lg';

export interface IconProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  className?: string;
  size?: IconSize;
}

// Lucide draws `stroke-width: 2` on a 24 viewBox, so a rendered stroke is
// `size / 12`: 1px at 12px but 1.67px at 20px. Pinning the stroke per size to
// `24 / size` holds every icon at a ~1px line, so a small icon and a large one
// read as the same family, and the line stays crisp at 1x. The selector is
// `[&>svg]`, so a control that renders a bare `<svg>` child rather than an
// `<Icon>` wrapper reads the same rung from this one map.
export const iconSizeClasses: Record<IconSize, string> = {
  xs: '[&>svg]:size-icon-xs [&>svg]:[stroke-width:2]',
  sm: '[&>svg]:size-icon-sm [&>svg]:[stroke-width:1.75]',
  md: '[&>svg]:size-icon-md [&>svg]:[stroke-width:1.5]',
  lg: '[&>svg]:size-icon-lg [&>svg]:[stroke-width:1.25]',
};

export const Icon = ({ children, className, size = 'md', ...props }: IconProps) => {
  return (
    <span className={cn('block', iconSizeClasses[size], className)} {...props}>
      {children}
    </span>
  );
};
