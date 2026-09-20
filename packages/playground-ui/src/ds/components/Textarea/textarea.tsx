import '../../../../new-theme.css';
import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import * as React from 'react';

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
import { cn } from '@/lib/utils';

const textareaVariants = cva(
  cn(
    'new-theme flex w-full border bg-transparent text-foreground',
    'transition-[background-color,border-color,color] duration-normal ease-out-custom motion-reduce:transition-none',
    'placeholder:text-muted-foreground placeholder:transition-opacity placeholder:duration-normal',
    'focus:placeholder:opacity-70 motion-reduce:placeholder:transition-none',
    // Textarea specific
    'min-h-20 resize-y',
  ),
  {
    variants: {
      variant: {
        default: cn(
          inputSurfaceAndFocusStyle,
          'rounded-xl',
          sharedFormElementDisabledStyle,
          disabledFilledSurfaceStyle,
        ),
        outline: cn(
          inputOutlineAndFocusStyle,
          'rounded-xl',
          sharedFormElementDisabledStyle,
          disabledOutlineSurfaceStyle,
        ),
        unstyled: unstyledFormElementStyle,
      },
      // Text tokens mirror the Input size scale (xs→ui-xs, sm→ui-sm, md→ui-smd, lg→ui-md)
      // so a Textarea reads at the same size as a sibling Input.
      size: {
        xs: 'px-1.5 py-1 text-ui-xs',
        sm: 'px-2 py-1.5 text-ui-sm',
        md: 'px-2.5 py-1.5 text-ui-smd',
        lg: 'px-3 py-2 text-ui-md',
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
          error && 'border-error focus-visible:border-error',
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
