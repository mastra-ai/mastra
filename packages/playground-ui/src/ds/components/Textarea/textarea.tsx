import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import * as React from 'react';

import {
  inputOutlineAndFocusStyle,
  inputSurfaceAndFocusStyle,
  sharedFormElementDisabledStyle,
  unstyledFormElementStyle,
} from '@/ds/primitives/form-element';
import { cn } from '@/lib/utils';

const textareaVariants = cva(
  cn(
    // Base styles with enhanced transitions
    'flex w-full border bg-transparent text-neutral6',
    'duration-normal transition-all ease-out-custom',
    // Better placeholder styling
    'placeholder:duration-normal placeholder:text-neutral2 placeholder:transition-opacity',
    'focus:placeholder:opacity-70',
    // Textarea specific
    'min-h-20 resize-y',
  ),
  {
    variants: {
      variant: {
        default: cn(inputSurfaceAndFocusStyle, 'rounded-xl', sharedFormElementDisabledStyle),
        filled: cn(inputSurfaceAndFocusStyle, 'rounded-xl', sharedFormElementDisabledStyle),
        outline: cn(inputOutlineAndFocusStyle, 'rounded-xl', sharedFormElementDisabledStyle),
        unstyled: unstyledFormElementStyle,
      },
      // Text tokens mirror the Input size scale (sm→ui-sm, md/default→ui-md, lg→ui-lg)
      // so a Textarea reads at the same size as a sibling Input.
      size: {
        sm: 'px-2 py-1.5 text-ui-sm',
        md: 'px-3 py-2 text-ui-md',
        default: 'px-3 py-2 text-ui-md',
        lg: 'px-4 py-3 text-ui-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export type TextareaProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> &
  VariantProps<typeof textareaVariants> & {
    testId?: string;
    error?: boolean;
  };

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, size, testId, variant, error, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          textareaVariants({ variant, size }),
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
