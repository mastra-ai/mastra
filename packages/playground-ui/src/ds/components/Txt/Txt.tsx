import type { HTMLAttributes, ReactNode } from 'react';

import type { FontSizes } from '../../tokens';
import { cn } from '@/lib/utils';

export interface TxtProps extends HTMLAttributes<HTMLDivElement | HTMLLabelElement> {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'label' | 'div';
  variant?: keyof typeof FontSizes;
  font?: 'mono';
  htmlFor?: string;
  className?: string;
  title?: string;
  children?: ReactNode;
}

const variants = {
  // UI text sizes
  'ui-xs': 'text-ui-xs leading-ui-xs',
  'ui-sm': 'text-ui-sm leading-ui-sm',
  'ui-smd': 'text-ui-smd leading-ui-smd',
  'ui-md': 'text-ui-md leading-ui-md',
  'ui-lg': 'text-ui-lg leading-ui-lg',
  // Header sizes
  'header-xs': 'text-header-xs leading-header-xs',
  'header-sm': 'text-header-sm leading-header-sm',
  'header-md': 'text-header-md leading-header-md',
  'header-lg': 'text-header-lg leading-header-lg',
  'header-xl': 'text-header-xl leading-header-xl',
};

const fonts = {
  mono: 'font-mono',
};

export const Txt = ({ as: Root = 'p', className, variant = 'ui-md', font, ...props }: TxtProps) => {
  return <Root className={cn(variants[variant], font && fonts[font], className)} {...props} />;
};
