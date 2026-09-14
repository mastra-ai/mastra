import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { useKeyboardNavigation } from '@/ds/primitives/focus/use-keyboard-navigation';

import {
  inputOutlineAndFocusStyle,
  inputSurfaceAndFocusStyle,
  sharedFormElementDisabledStyle,
  unstyledFormElementStyle,
} from '@/ds/primitives/form-element';
import { cn } from '@/lib/utils';

const textareaVariants = cva(
  cn(
    'flex w-full border bg-transparent text-neutral6',
    'transition-all duration-normal ease-out-custom',
    'placeholder:text-neutral2 placeholder:transition-opacity placeholder:duration-normal',
    'focus:placeholder:opacity-70',
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
  VariantProps<typeof textareaVariants> & {
    testId?: string;
    error?: boolean;
  };

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, size, testId, variant, error, ...props }, ref) => {
    useKeyboardNavigation();
    return (
      <textarea
        className={cn(
          textareaVariants({ variant, size }),
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
Textarea.displayName = 'Textarea';

export { Textarea };
