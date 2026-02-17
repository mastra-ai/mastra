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
  // 'tiny' | 'small' | 'default' | 'large' are experimental values do not use it yet
  size?: FormElementSize | 'tiny' | 'small' | 'default' | 'large';
  // 'cta' and 'standard' are experimental variants do not use it yet
  variant?: 'default' | 'light' | 'outline' | 'ghost' | 'primary' | 'cta' | 'standard';
  target?: string;
  type?: 'button' | 'submit' | 'reset';
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

const sizeClasses = {
  sm: `${formElementSizes.sm} gap-1 text-ui-sm`,
  md: `${formElementSizes.md} gap-1`,
  lg: `${formElementSizes.lg} gap-2`,
  tiny: `min-h-[1.5rem] text-ui-sm`,
  small: `min-h-[2rem] text-ui-md`,
  default: `min-h-[2.25rem] text-ui-md`,
  large: `min-h-[2.5rem] text-ui-lg`,
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
  cta: 'bg-white/20  hover:text-white hover:bg-white/25 disabled:opacity-50 disabled:cursor-not-allowed active:bg-white/30 text-neutral5',
  standard:
    'bg-white/10  hover:text-white hover:bg-white/15 disabled:opacity-50 disabled:cursor-not-allowed active:bg-white/20 text-neutral4',
};

// Base button styles with transitions
const baseButtonStyles =
  'border border-border1 px-2 text-ui-md inline-flex items-center justify-center rounded-md transition-all duration-normal ease-out-custom active:scale-[0.98]';

const newBaseButtonStyles = cn(
  'flex items-center justify-center rounded-lg gap-[.75em] px-[1em] leading-0 transition-colors duration-200 ease-out-custom ',
  '[&>svg]:w-[1.1em] [&>svg]:h-[1.1em] [&>svg]:opacity-50 [&>svg]:mx-[-.25em]',
  '[&:hover>svg]:opacity-100',
);

const newFocusStyle =
  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent1/50 focus-visible:shadow-[inset_0_0_0_4px_rgba(34,197,94,0.25)]';

export function buttonVariants(options?: { variant?: ButtonProps['variant']; size?: ButtonProps['size'] }) {
  const variant = options?.variant || 'default';
  const size = options?.size || 'md';

  return cn(baseButtonStyles, formElementFocus, variantClasses[variant], sizeClasses[size]);
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, as, size = 'md', variant = 'default', disabled, ...props }, ref) => {
    const Component = as || 'button';

    const isExperimentalButton = ['cta', 'standard'].includes(variant);

    return (
      <Component
        ref={ref}
        disabled={disabled}
        className={cn(
          isExperimentalButton ? newBaseButtonStyles : baseButtonStyles,
          isExperimentalButton ? newFocusStyle : formElementFocus,
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
