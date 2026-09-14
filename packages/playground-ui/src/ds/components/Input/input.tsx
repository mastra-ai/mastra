import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { controlSizeClasses } from '@/ds/primitives/control-size';
import '@/ds/primitives/focus.css';
import {
  inputOutlineAndFocusStyle,
  inputSurfaceAndFocusStyle,
  sharedFormElementDisabledStyle,
  unstyledFormElementStyle,
} from '@/ds/primitives/form-element';
import { cn } from '@/lib/utils';

const inputVariants = cva(
  cn(
    'flex w-full border bg-transparent text-neutral6',
    'transition-all duration-normal ease-out-custom',
    'placeholder:text-neutral2 placeholder:transition-opacity placeholder:duration-normal',
    'focus:placeholder:opacity-70',
    '[&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none',
    '[&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none',
    '[&[type=number]]:[appearance:textfield]',
    '[&::-webkit-search-cancel-button]:appearance-none',
  ),
  {
    variants: {
      variant: {
        default: cn(inputSurfaceAndFocusStyle, 'rounded-full', sharedFormElementDisabledStyle),
        filled: cn(inputSurfaceAndFocusStyle, 'rounded-full', sharedFormElementDisabledStyle),
        outline: cn(inputOutlineAndFocusStyle, 'rounded-full', sharedFormElementDisabledStyle),
        unstyled: unstyledFormElementStyle,
      },
      size: {
        xs: cn(controlSizeClasses.xs, 'px-[.75em]'),
        sm: cn(controlSizeClasses.sm, 'px-[.75em]'),
        md: cn(controlSizeClasses.md, 'px-[.75em]'),
        lg: cn(controlSizeClasses.lg, 'px-[.85em]'),
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
          error && 'border-error hover:border-error focus-visible:border-error',
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

export { Input };
