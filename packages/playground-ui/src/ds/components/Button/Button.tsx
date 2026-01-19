import React from 'react';
import { cn } from '@/lib/utils';
import { formElementSizes, formElementFocus, type FormElementSize } from '@/ds/primitives/form-element';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  as?: React.ElementType;
  className?: string;
  href?: string;
  to?: string;
  prefetch?: boolean | null;
  children: React.ReactNode;
  size?: FormElementSize;
  variant?: 'default' | 'light' | 'outline' | 'ghost' | 'primary';
  target?: string;
  type?: 'button' | 'submit' | 'reset';
}

const sizeClasses = {
  sm: `${formElementSizes.sm} gap-0.5`,
  md: `${formElementSizes.md} gap-1`,
  lg: `${formElementSizes.lg} gap-2`,
};

// Enhanced variant classes with transitions and subtle interactions
const variantClasses = {
  default:
    'bg-surface2 hover:bg-surface4 text-neutral3 hover:text-neutral6 disabled:opacity-50 disabled:cursor-not-allowed',
  light: 'bg-surface3 hover:bg-surface5 text-neutral6 disabled:opacity-50 disabled:cursor-not-allowed',
  outline:
    'bg-transparent hover:bg-surface2 text-neutral3 hover:text-neutral6 disabled:opacity-50 disabled:cursor-not-allowed',
  ghost:
    'bg-transparent border-transparent hover:bg-surface2 text-neutral3 hover:text-neutral6 disabled:opacity-50 disabled:cursor-not-allowed',
  primary:
    'bg-accent1 hover:bg-accent1/90 text-surface1 font-medium hover:shadow-glow-accent1 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none',
};

// Base button styles with transitions
const baseButtonStyles =
  'border border-border1 px-2 text-ui-md inline-flex items-center justify-center rounded-md transition-all duration-normal ease-out-custom active:scale-[0.98]';

export function buttonVariants(options?: { variant?: ButtonProps['variant']; size?: ButtonProps['size'] }) {
  const variant = options?.variant || 'default';
  const size = options?.size || 'md';

  return cn(baseButtonStyles, formElementFocus, variantClasses[variant], sizeClasses[size]);
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, as, size = 'md', variant = 'default', disabled, ...props }, ref) => {
    const Component = as || 'button';

    return (
      <Component
        ref={ref}
        disabled={disabled}
        className={cn(
          baseButtonStyles,
          formElementFocus,
          variantClasses[variant],
          sizeClasses[size],
          // Remove active scale when disabled
          disabled && 'active:scale-100',
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = 'Button';
