import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface IconProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  className?: string;
  size?: 'default' | 'lg' | 'sm' | 'smd';
}

// Lucide draws `stroke-width: 2` on a 24 viewBox, so a rendered stroke is
// `size / 12`: 1px at 12px but 1.67px at 20px. Pinning the stroke per size to
// `24 / size` holds every icon at a ~1px line, so a small icon and a large one
// read as the same family, and the line stays crisp at 1x.
const sizes = {
  sm: '[&>svg]:h-icon-sm [&>svg]:w-icon-sm [&>svg]:[stroke-width:2]',
  smd: '[&>svg]:h-icon-smd [&>svg]:w-icon-smd [&>svg]:[stroke-width:1.75]',
  default: '[&>svg]:h-icon-default [&>svg]:w-icon-default [&>svg]:[stroke-width:1.5]',
  lg: '[&>svg]:h-icon-lg [&>svg]:w-icon-lg [&>svg]:[stroke-width:1.25]',
};

export const Icon = ({ children, className, size = 'default', ...props }: IconProps) => {
  return (
    <span className={cn('block', sizes[size], className)} {...props}>
      {children}
    </span>
  );
};
