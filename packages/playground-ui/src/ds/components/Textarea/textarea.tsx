import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import * as React from 'react';

import {
  sharedFormElementStyle,
  sharedFormElementFocusStyle,
  sharedFormElementDisabledStyle,
} from '@/ds/primitives/form-element';
import { cn } from '@/lib/utils';

const textareaVariants = cva(
  cn(
    // Base styles with enhanced transitions
    'flex w-full text-neutral6 border bg-transparent',
    'transition-all duration-normal ease-out-custom',
    // Better placeholder styling
    'placeholder:text-neutral2 placeholder:transition-opacity placeholder:duration-normal',
    'focus:placeholder:opacity-70',
    // Textarea specific
    'min-h-[80px] resize-y',
  ),
  {
    variants: {
      variant: {
        default: cn(sharedFormElementStyle, sharedFormElementFocusStyle, sharedFormElementDisabledStyle),
        unstyled: 'border-0 bg-transparent shadow-none focus:shadow-none focus:ring-0',
      },
      size: {
        sm: 'px-2 py-1.5 text-ui-sm',
        md: 'px-3 py-2 text-ui-sm',
        default: 'px-3 py-2 text-ui-md',
        lg: 'px-4 py-3 text-ui-sm',
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
Textarea.displayName = 'Textarea';

export { Textarea, textareaVariants };
