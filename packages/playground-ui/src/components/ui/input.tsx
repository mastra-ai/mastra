import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import * as React from 'react';

import clsx from 'clsx';

const inputVariants = cva(
  'flex w-full text-icon6 rounded-lg border bg-transparent shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'border-sm border-border1 placeholder:text-icon3',
        filled: 'border-sm bg-inputFill border-border1 placeholder:text-icon3',
        unstyled: 'border-0 bg-transparent placeholder:text-icon3',
      },
      customSize: {
        default: 'px-[13px] text-[calc(13_/_16_*_1rem)] h-8',
        sm: 'h-[30px] px-[13px] text-xs',
        lg: 'h-10 px-[17px] text-[calc(13_/_16_*_1rem)]',
      },
    },
    defaultVariants: {
      variant: 'default',
      customSize: 'default',
    },
  },
);

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement>, VariantProps<typeof inputVariants> {
  testId?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, customSize, testId, variant, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={clsx(className, inputVariants({ variant, customSize, className }))}
        data-testid={testId}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input, inputVariants };
