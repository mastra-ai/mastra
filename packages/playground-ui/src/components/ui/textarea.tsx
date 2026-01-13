import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import * as React from 'react';

import clsx from 'clsx';

const textareaVariants = cva(
  'flex w-full text-icon6 rounded-lg border bg-transparent shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 resize-none',
  {
    variants: {
      variant: {
        default: 'border-sm border-border1 placeholder:text-icon3',
        filled: 'border-sm bg-inputFill border-border1 placeholder:text-icon3',
        unstyled: 'border-0 bg-transparent placeholder:text-icon3',
      },
      customSize: {
        default: 'px-[13px] py-2 text-[calc(13_/_16_*_1rem)] min-h-[80px]',
        sm: 'px-[13px] py-1.5 text-xs min-h-[60px]',
        lg: 'px-[17px] py-3 text-[calc(13_/_16_*_1rem)] min-h-[120px]',
      },
    },
    defaultVariants: {
      variant: 'default',
      customSize: 'default',
    },
  },
);

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> &
  VariantProps<typeof textareaVariants> & {
    testId?: string;
  };

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, customSize, testId, variant, ...props }, ref) => {
    return (
      <textarea
        className={clsx(className, textareaVariants({ variant, customSize, className }))}
        data-testid={testId}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = 'Textarea';

export { Textarea, textareaVariants };
