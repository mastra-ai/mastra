'use client';

import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';
import { formElementRadius, formElementFocus } from '@/ds/primitives/form-element';

const cmsInputVariants = cva(
  cn(
    'flex w-full text-neutral6 bg-transparent',
    'border border-dashed border-border1',
    'transition-all duration-normal ease-out-custom',
    'hover:border-border2',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'placeholder:text-neutral2 placeholder:transition-opacity placeholder:duration-normal',
    'focus:placeholder:opacity-70',
    formElementRadius,
    formElementFocus,
  ),
  {
    variants: {
      size: {
        xl: 'h-form-xl px-4 text-header-lg font-medium',
        lg: 'h-form-lg px-4 text-header-sm',
      },
    },
    defaultVariants: {
      size: 'xl',
    },
  },
);

export type CmsInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> &
  VariantProps<typeof cmsInputVariants> & {
    label: string;
    testId?: string;
    error?: boolean;
  };

const CmsInput = React.forwardRef<HTMLInputElement, CmsInputProps>(
  ({ className, size, label, testId, error, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || `cms-input-${generatedId}`;

    return (
      <div className="flex flex-col">
        <label htmlFor={inputId} className="sr-only">
          {label}
        </label>
        <input
          id={inputId}
          type="text"
          className={cn(
            cmsInputVariants({ size }),
            error && 'border-accent2 focus:ring-accent2 focus:shadow-glow-accent2',
            className,
          )}
          data-testid={testId}
          ref={ref}
          aria-invalid={error}
          {...props}
        />
      </div>
    );
  },
);
CmsInput.displayName = 'CmsInput';

export { CmsInput, cmsInputVariants };
