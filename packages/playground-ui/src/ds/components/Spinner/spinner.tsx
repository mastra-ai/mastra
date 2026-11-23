import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import type { ComponentPropsWithoutRef } from 'react';

import { LoaderFill } from '../LoaderFill/loader-fill';
import { cn } from '@/lib/utils';

import './spinner.css';

const spinnerVariants = cva('spinner inline-block text-foreground', {
  variants: {
    size: {
      sm: 'size-4',
      md: 'size-6',
      lg: 'size-8',
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

export type SpinnerProps = Omit<ComponentPropsWithoutRef<'svg'>, 'color' | 'size' | 'fill'> &
  SpinnerVariantsProps & {
    /** Center the spinner in its parent, or in the window with `screen`. See `LoaderFill`. */
    fill?: boolean | 'screen';
  };

function Spinner({
  className,
  size = 'md',
  variant = 'default',
  fill = false,
  'aria-label': ariaLabel = 'Loading',
  role = 'status',
  ...props
}: SpinnerProps) {
  const resolvedSize = size ?? 'md';
  const resolvedVariant = variant ?? 'default';

  const svg = (
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

  if (fill) return <LoaderFill area={fill === 'screen' ? 'screen' : 'parent'}>{svg}</LoaderFill>;

  return svg;
}

export { Spinner };
