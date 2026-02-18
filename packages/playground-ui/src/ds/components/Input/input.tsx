import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';
import { formElementSizes, formElementFocus, formElementRadius } from '@/ds/primitives/form-element';

const inputVariants = cva(
  cn(
    // Base styles with enhanced transitions
    'flex w-full text-neutral6 border bg-transparent',
    'transition-all duration-normal ease-out-custom',
    'disabled:cursor-not-allowed disabled:opacity-50',
    // Better placeholder styling
    'placeholder:text-neutral2 placeholder:transition-opacity placeholder:duration-normal',
    'focus:placeholder:opacity-70',
    formElementRadius,
    formElementFocus,
  ),
  {
    variants: {
      variant: {
        default: 'border border-border1 hover:border-border2',
        filled: 'border bg-surface2 border-border1 hover:border-border2',
        unstyled: 'border-0 bg-transparent shadow-none focus:shadow-none focus:ring-0',
      },
      size: {
        sm: `${formElementSizes.sm} px-2 text-ui-sm`,
        md: `${formElementSizes.md} px-3 text-ui-sm`,
        lg: `${formElementSizes.lg} px-4 text-ui-sm`,
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);

export type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> &
  VariantProps<typeof inputVariants> & {
    testId?: string;
    error?: boolean;
  };

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, size, testId, variant, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          inputVariants({ variant, size }),
          // Error state styling
          error && 'border-error focus:ring-error focus:shadow-glow-accent2',
          className,
        )}
        data-testid={testId}
        ref={ref}
        aria-invalid={error}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input, inputVariants };
