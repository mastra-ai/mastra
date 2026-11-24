import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import * as React from 'react';

import {
  deprecatedErrorAria,
  fieldErrorRim,
  fieldMonoStyle,
  fieldPlaceholderStyle,
  inputSurfaceAndFocusStyle,
  resolveFieldVariant,
  sharedFormElementDisabledStyle,
  unstyledFormElementStyle,
} from '@/ds/primitives/form-element';
import type { DeprecatedFilledVariant } from '@/ds/primitives/form-element';
import { TextareaControl } from '@/ds/primitives/textarea-control';
import { controlStateColorTransition } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

const textareaVariants = cva(
  cn(
    'flex w-full zoom-safe-text text-foreground',
    controlStateColorTransition,
    fieldPlaceholderStyle,
    fieldMonoStyle,
    // Textarea specific
    'min-h-20 resize-y',
  ),
  {
    variants: {
      variant: {
        default: cn(inputSurfaceAndFocusStyle, 'rounded-xl', sharedFormElementDisabledStyle),
        unstyled: unstyledFormElementStyle,
      },
      // Text here is prose that wraps, so it stays at the regular weight; single-line fields use `text-label`.
      size: {
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

export type TextareaProps = Omit<React.ComponentProps<'textarea'>, 'size'> &
  Omit<VariantProps<typeof textareaVariants>, 'variant'> & {
    /** `filled` is a deprecated alias for `default`; both render the filled surface. */
    variant?: VariantProps<typeof textareaVariants>['variant'] | DeprecatedFilledVariant;
    testId?: string;
    /** @deprecated Wrap the control in `<Field invalid>`, or set `aria-invalid` on a control outside a `Field`. */
    error?: boolean;
  };

function Textarea({ className, size, testId, variant, error, ...props }: TextareaProps) {
  return (
    <TextareaControl
      className={cn(textareaVariants({ variant: resolveFieldVariant(variant), size }), fieldErrorRim, className)}
      data-testid={testId}
      {...deprecatedErrorAria(error)}
      {...props}
    />
  );
}

export { Textarea };
