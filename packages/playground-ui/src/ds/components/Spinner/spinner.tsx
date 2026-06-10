import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '@/lib/utils';

import './spinner.css';

const spinnerVariants = cva('spinner inline-block text-neutral6', {
  variants: {
    size: {
      sm: 'w-4 h-4',
      md: 'w-6 h-6',
    },
    variant: {
      default: '',
      pulse: '',
    },
  },
  defaultVariants: {
    size: 'md',
    variant: 'default',
  },
});

type SpinnerVariantsProps = VariantProps<typeof spinnerVariants>;
export type SpinnerVariant = NonNullable<SpinnerVariantsProps['variant']>;
export type SpinnerSize = NonNullable<SpinnerVariantsProps['size']>;

export type SpinnerProps = Omit<ComponentPropsWithoutRef<'svg'>, 'color' | 'size'> & SpinnerVariantsProps;

function Spinner({
  className,
  size = 'md',
  variant = 'default',
  'aria-label': ariaLabel = 'Loading',
  role = 'status',
  ...props
}: SpinnerProps) {
  const resolvedSize = size ?? 'md';
  const resolvedVariant = variant ?? 'default';

  return (
    <svg
      {...props}
      role={role}
      aria-label={ariaLabel}
      data-size={resolvedSize}
      data-variant={resolvedVariant}
      className={cn(spinnerVariants({ size: resolvedSize, variant: resolvedVariant }), className)}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
    >
      {resolvedVariant === 'pulse' ? (
        <>
          <circle className="spinner-pulse-ring" cx="12" cy="12" r="7" />
          <circle className="spinner-pulse-core" cx="12" cy="12" r="5" />
        </>
      ) : (
        <circle className="spinner-ring" cx="12" cy="12" r="8.5" />
      )}
    </svg>
  );
}

export { Spinner };
