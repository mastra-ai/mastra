import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import React from 'react';

import { cn } from '../../lib/utils';

const textVariants = cva('block', {
  variants: {
    variant: {
      primary: 'text-text',
      secondary: 'text-text-dim',
    },
    size: {
      default: 'text-base',
      xs: 'text-xs',
      sm: 'text-sm',
      md: 'text-md',
      lg: 'text-lg',
      xl: 'text-xl',
      '2xl': 'text-2xl',
    },
    weight: {
      normal: 'font-normal',
      medium: 'font-medium',
      semibold: 'font-semibold',
      bold: 'font-bold',
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'default',
    weight: 'normal',
  },
});

export interface TextProps
  extends React.HTMLAttributes<HTMLParagraphElement | HTMLSpanElement | HTMLDivElement>,
    VariantProps<typeof textVariants> {
  as?: 'p' | 'span' | 'div';
}

export const Text = ({ className, weight, variant, as: Tag = 'span', size, ...props }: TextProps) => {
  return <Tag className={cn(textVariants({ size, variant, weight, className }))} {...props} />;
};
