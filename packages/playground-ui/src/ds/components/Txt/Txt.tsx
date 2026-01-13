import clsx from 'clsx';
import React from 'react';

import { FontSizes } from '../../tokens';

export type TxtWeight = 'normal' | 'medium' | 'semibold' | 'bold';
export type TxtColor = 'default' | 'dim' | 'muted';

export interface TxtProps extends React.HTMLAttributes<HTMLDivElement | HTMLLabelElement> {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'label';
  variant?: keyof typeof FontSizes;
  font?: 'mono';
  weight?: TxtWeight;
  color?: TxtColor;
  htmlFor?: string;
  className?: string;
  children?: React.ReactNode;
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

const weights: Record<TxtWeight, string> = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
};

const colors: Record<TxtColor, string> = {
  default: 'text-text',
  dim: 'text-text-dim',
  muted: 'text-text-muted',
};

export const Txt = ({ as: Root = 'p', className, variant = 'ui-md', font, weight, color, ...props }: TxtProps) => {
  return (
    <Root
      className={clsx(
        variants[variant],
        font && fonts[font],
        weight && weights[weight],
        color && colors[color],
        className,
      )}
      {...props}
    />
  );
};
