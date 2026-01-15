import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';
import { formElementSizes, formElementFocus, formElementRadius } from '@/ds/primitives/form-element';

const inputVariants = cva(
  cn(
    'flex w-full text-neutral6 border bg-transparent shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50',
    formElementRadius,
    formElementFocus,
  ),
  {
    variants: {
      variant: {
        default: 'border border-border1 placeholder:text-neutral3',
        filled: 'border bg-inputFill border-border1 placeholder:text-neutral3',
        unstyled: 'border-0 bg-transparent placeholder:text-neutral3',
      },
      size: {
        sm: `${formElementSizes.sm} px-2 text-ui-sm`,
        md: `${formElementSizes.md} px-3 text-ui-sm`,
        lg: `${formElementSizes.lg} px-4 text-ui-sm`,
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);

export type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> &
  VariantProps<typeof inputVariants> & {
    testId?: string;
  };

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, size, testId, variant, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(className, inputVariants({ variant, size, className }))}
        data-testid={testId}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input, inputVariants };
