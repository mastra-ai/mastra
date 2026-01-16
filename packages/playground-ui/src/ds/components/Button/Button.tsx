import React from 'react';
import { cn } from '@/lib/utils';
import {
  formElementSizes,
  formElementFocus,
  formElementBorder,
  formElementRadius,
  formElementDisabled,
  type FormElementSize,
} from '@/ds/primitives/form-element';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  as?: React.ElementType;
  className?: string;
  href?: string;
  to?: string;
  prefetch?: boolean | null;
  children: React.ReactNode;
  size?: FormElementSize;
  variant?: 'default' | 'light' | 'outline' | 'ghost';
  target?: string;
  type?: 'button' | 'submit' | 'reset';
}

const sizeClasses = {
  sm: `${formElementSizes.sm} gap-0.5`,
  md: `${formElementSizes.md} gap-1`,
  lg: `${formElementSizes.lg} gap-2`,
};

const variantClasses = {
  default: 'bg-surface2 hover:bg-surface4 text-neutral3 hover:text-neutral6',
  light: 'bg-surface3 hover:bg-surface5 text-neutral6',
  outline: 'bg-transparent hover:bg-surface2 text-neutral3 hover:text-neutral6',
  ghost: 'bg-transparent border-transparent hover:bg-surface2 text-neutral3 hover:text-neutral6',
};

const buttonBase = cn(
  'px-2 text-ui-md inline-flex items-center justify-center',
  formElementBorder,
  formElementRadius,
  formElementFocus,
  formElementDisabled,
);

export function buttonVariants(options?: { variant?: ButtonProps['variant']; size?: ButtonProps['size'] }) {
  const variant = options?.variant || 'default';
  const size = options?.size || 'md';

  return cn(buttonBase, variantClasses[variant], sizeClasses[size]);
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, as, size = 'md', variant = 'default', ...props }, ref) => {
    const Component = as || 'button';

    return <Component ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
  },
);

Button.displayName = 'Button';
