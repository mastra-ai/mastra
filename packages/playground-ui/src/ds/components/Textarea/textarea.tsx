import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import * as React from 'react';

import {
  disabledOutlineSurfaceStyle,
  inputOutlineAndFocusStyle,
  inputSurfaceAndFocusStyle,
  resolveFieldVariant,
  sharedFormElementDisabledStyle,
  unstyledFormElementStyle,
} from '@/ds/primitives/form-element';
import type { DeprecatedFilledVariant } from '@/ds/primitives/form-element';
import { controlStateColorTransition } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

const textareaVariants = cva(
  cn(
    'flex w-full text-foreground',
    controlStateColorTransition,
    'placeholder:text-muted-foreground placeholder:transition-opacity placeholder:duration-normal',
    'focus:placeholder:opacity-70 motion-reduce:placeholder:transition-none',
    // Textarea specific
    'min-h-20 resize-y',
  ),
  {
    variants: {
      variant: {
        default: cn(inputSurfaceAndFocusStyle, 'rounded-xl', sharedFormElementDisabledStyle),
        outline: cn(
          inputOutlineAndFocusStyle,
          'rounded-xl',
          sharedFormElementDisabledStyle,
          disabledOutlineSurfaceStyle,
        ),
        unstyled: unstyledFormElementStyle,
      },
      // Text roles mirror the Input size scale so a Textarea reads at the same size as a
      // sibling Input: a field value is 400 weight at every height.
      size: {
        xs: 'px-1.5 py-1 text-meta',
        sm: 'px-2 py-1.5 text-caption',
        md: 'px-2.5 py-1.5 text-body-sm',
        lg: 'px-3 py-2 text-body',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);

export type TextareaProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> &
  Omit<VariantProps<typeof textareaVariants>, 'variant'> & {
    /** `filled` is a deprecated alias for `default`; both render the filled surface. */
    variant?: VariantProps<typeof textareaVariants>['variant'] | DeprecatedFilledVariant;
    testId?: string;
    error?: boolean;
  };

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, size, testId, variant, error, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          textareaVariants({ variant: resolveFieldVariant(variant), size }),
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
Textarea.displayName = 'Textarea';

export { Textarea };
