import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import * as React from 'react';

import {
  formElementSizes,
  sharedFormElementStyle,
  sharedFormElementFocusStyle,
  sharedFormElementDisabledStyle,
} from '@/ds/primitives/form-element';
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
        default: cn(sharedFormElementStyle, sharedFormElementFocusStyle, sharedFormElementDisabledStyle),
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
