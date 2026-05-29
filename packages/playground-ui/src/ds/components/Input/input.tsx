import type { VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { inputVariants } from './input-variants';
import { cn } from '@/lib/utils';

export type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> &
  VariantProps<typeof inputVariants> & {
    testId?: string;
    error?: boolean;
    /** Decorative/interactive node rendered before the input (e.g. a search icon). */
    leadingIcon?: React.ReactNode;
    /** Node rendered after the input (e.g. a clear button or a unit). */
    trailingIcon?: React.ReactNode;
  };

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, size, testId, variant, type, error, leadingIcon, trailingIcon, ...props }, ref) => {
    const errorClassName = error ? 'border-error focus-visible:border-error' : undefined;

    // With an icon, the styled box is a flex wrapper and the <input> is a transparent fill.
    // The wrapper stays the direct child so a ButtonsGroup's corner/border CSS still targets
    // it, and it hoists the focus indicator (via has-[:focus-visible]) so the outline follows
    // its rounded shape instead of drawing a square outline on the rectangular input.
    if (leadingIcon || trailingIcon) {
      // The wrapper is a non-focusable <div>, so the variant's `focus-visible:*` rules are inert
      // here — re-express the focus border via `has-[input:focus-visible]`. The error border must
      // also use the has() hook: a plain `border-error` (0,1,0) loses to the has() focus border
      // (0,2,1) on focus, silently dropping the red cue exactly when the user focuses to fix it.
      const iconErrorClassName = error ? 'border-error has-[input:focus-visible]:border-error' : undefined;
      return (
        <div
          className={cn(
            inputVariants({ variant, size }),
            'items-center gap-2',
            'has-[input:focus-visible]:border-neutral5/50',
            iconErrorClassName,
            className,
          )}
        >
          {leadingIcon && (
            <span className="pointer-events-none flex shrink-0 items-center text-neutral3 [&>svg]:size-4">
              {leadingIcon}
            </span>
          )}
          <input
            type={type}
            ref={ref}
            data-testid={testId}
            aria-invalid={error}
            className={cn(
              // Borderless, ringless fill — the wrapper owns the box + focus outline.
              'min-w-0 flex-1 border-0 bg-transparent p-0 text-inherit outline-none focus-visible:outline-none',
              'placeholder:text-neutral2 placeholder:transition-opacity placeholder:duration-normal focus:placeholder:opacity-70',
              '[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0',
              '[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0',
              // type="search": drop WebKit's native clear button (custom trailingIcon owns clearing).
              '[&::-webkit-search-cancel-button]:appearance-none',
            )}
            {...props}
          />
          {trailingIcon && (
            <span className="flex shrink-0 items-center text-neutral3 [&>svg]:size-4">{trailingIcon}</span>
          )}
        </div>
      );
    }

    return (
      <input
        type={type}
        className={cn(inputVariants({ variant, size }), errorClassName, className)}
        data-testid={testId}
        ref={ref}
        aria-invalid={error}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };
