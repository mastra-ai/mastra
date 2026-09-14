import { createElement } from 'react';
import type { ComponentPropsWithRef } from 'react';

import type { FontSizes } from '../../tokens';
import { cn } from '@/lib/utils';

export type TxtElement = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'label' | 'div';

export type TxtProps<TElement extends TxtElement = 'p'> = {
  as?: TElement;
  variant?: keyof typeof FontSizes;
  font?: 'mono';
} & ComponentPropsWithRef<TElement>;

const variants = {
  'ui-xs': 'text-ui-xs leading-ui-xs',
  'ui-sm': 'text-ui-sm leading-ui-sm',
  'ui-smd': 'text-ui-smd leading-ui-smd',
  'ui-md': 'text-ui-md leading-ui-md',
  'ui-lg': 'text-ui-lg leading-ui-lg',
  'header-xs': 'text-header-xs leading-header-xs',
  'header-sm': 'text-header-sm leading-header-sm',
  'header-md': 'text-header-md leading-header-md',
  'header-lg': 'text-header-lg leading-header-lg',
  'header-xl': 'text-header-xl leading-header-xl',
};

const fonts = {
  mono: 'font-mono',
};

export const Txt = <TElement extends TxtElement = 'p'>({
  as,
  className,
  variant = 'ui-md',
  font,
  ...props
}: TxtProps<TElement>) => {
  return createElement(as ?? 'p', { className: cn(variants[variant], font && fonts[font], className), ...props });
};
