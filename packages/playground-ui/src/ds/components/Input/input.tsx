import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { controlSizeClasses } from '@/ds/primitives/control-size';
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
    'duration-normal transition-all ease-out-custom',
    'placeholder:duration-normal placeholder:text-neutral2 placeholder:transition-opacity',
    'focus:placeholder:opacity-70',
    // type="number": hide native browser spinner arrows (they clip the pill).
    // For incrementable numeric inputs, compose <InputGroup> with +/- buttons
    // instead — see the NumberWithStepper story. WebKit uses the spin-button
    // pseudo-elements; Firefox needs `appearance: textfield` on the input.
    '[&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none',
    '[&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none',
    '[&[type=number]]:[appearance:textfield]',
    // type="search": drop WebKit's native clear button so the DS owns the search chrome.
    // Compose an <InputGroup> with an InputGroupButton to add a clear control.
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
        default: cn(controlSizeClasses.default, 'px-[.85em]'),
        lg: cn(controlSizeClasses.lg, 'px-[.85em]'),
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

export { Input };
