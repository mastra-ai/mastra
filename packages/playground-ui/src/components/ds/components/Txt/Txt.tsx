import clsx from 'clsx';
import React from 'react';

import { FontSizes } from '../../tokens';

export interface TxtProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span';
  variant?: keyof typeof FontSizes;
  font?: 'mono';
}

const variants = {
  'header-md': 'text-header-md leading-header-md',
  'ui-lg': 'text-ui-lg leading-ui-lg',
  'ui-md': 'text-ui-md leading-ui-md',
  'ui-sm': 'text-ui-sm leading-ui-sm',
  'ui-xs': 'text-ui-xs leading-ui-xs',
};

const fonts = {
  mono: 'font-mono',
};

export const Txt = ({ as: Root = 'p', className, variant = 'ui-md', font, ...props }: TxtProps) => {
  return <Root className={clsx(variants[variant], font && fonts[font], className)} {...props} />;
};
