import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { controlSizeClasses } from '@/ds/primitives/control-size';
import {
  disabledOutlineSurfaceStyle,
  disabledFilledSurfaceStyle,
  inputOutlineAndFocusStyle,
  inputSurfaceAndFocusStyle,
  resolveFieldVariant,
  sharedFormElementDisabledStyle,
  unstyledFormElementStyle,
} from '@/ds/primitives/form-element';
import type { DeprecatedFilledVariant } from '@/ds/primitives/form-element';
import { controlStateColorTransition } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

const inputVariants = cva(
  cn(
    // A text field is a block control: it fills its field. Content-sized controls (a
    // Select or Combobox trigger, a Button) do the opposite and let the call site grow them.
    'flex w-full border bg-transparent text-ellipsis text-foreground',
    controlStateColorTransition,
    'placeholder:text-muted-foreground placeholder:transition-opacity placeholder:duration-normal',
    'focus:placeholder:opacity-70 motion-reduce:placeholder:transition-none',
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
        default: cn(
          inputSurfaceAndFocusStyle,
          'rounded-full',
          sharedFormElementDisabledStyle,
          disabledFilledSurfaceStyle,
        ),
        outline: cn(
          inputOutlineAndFocusStyle,
          'rounded-full',
          sharedFormElementDisabledStyle,
          disabledOutlineSurfaceStyle,
        ),
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
  Omit<VariantProps<typeof inputVariants>, 'variant'> & {
    /** `filled` is a deprecated alias for `default`; both render the filled surface. */
    variant?: VariantProps<typeof inputVariants>['variant'] | DeprecatedFilledVariant;
    testId?: string;
    error?: boolean;
  };

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, size, testId, variant, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          inputVariants({ variant: resolveFieldVariant(variant), size }),
          error && 'border-destructive focus-visible:border-destructive',
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
