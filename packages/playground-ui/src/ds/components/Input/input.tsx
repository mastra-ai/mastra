import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { formElementSizes, sharedFormElementDisabledStyle } from '@/ds/primitives/form-element';
import { cn } from '@/lib/utils';

const inputVariants = cva(
  cn(
    'flex w-full text-neutral6 border bg-transparent',
    'transition-all duration-normal ease-out-custom',
    'placeholder:text-neutral2 placeholder:transition-opacity placeholder:duration-normal',
    'focus:placeholder:opacity-70',
  ),
  {
    variants: {
      variant: {
        default: cn(
          'bg-surface-overlay-soft border border-border1 text-neutral5 rounded-full',
          'hover:text-neutral6 hover:bg-surface-overlay-strong hover:border-border2',
          'outline-hidden focus-visible:outline-hidden focus-visible:bg-surface-overlay-strong focus-visible:border-border2',
          sharedFormElementDisabledStyle,
        ),
        unstyled: 'border-0 bg-transparent shadow-none focus:shadow-none focus:ring-0',
      },
      size: {
        sm: `${formElementSizes.sm} text-ui-sm px-[.75em]`,
        md: `${formElementSizes.md} text-ui-md px-[.75em]`,
        default: `${formElementSizes.default} text-ui-md px-[.85em]`,
        lg: `${formElementSizes.lg} text-ui-lg px-[.85em]`,
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
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
        className={cn(inputVariants({ variant, size }), error && 'border-error focus-visible:border-error', className)}
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
