import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// line: gradient hairline, fits a visible container edge.
// pill: small floating pill, for handles with no container around.
const indicatorVariants = cva(
  'pointer-events-none block transition-all duration-150 ease-out motion-reduce:transition-none',
  {
    variants: {
      variant: {
        line: 'h-3/4 w-px bg-linear-to-b from-transparent via-neutral6/25 to-transparent opacity-0',
        pill: 'h-10 w-0.5 rounded-full bg-surface5',
      },
    },
    defaultVariants: {
      variant: 'line',
    },
  },
);

export type ResizeHandleIndicatorProps = VariantProps<typeof indicatorVariants> & {
  className?: string;
};

// Shared visual for resize handles (sidebar, panel separators).
// Consumers reveal/emphasize it via their own state variant classes.
export const ResizeHandleIndicator = ({ variant, className }: ResizeHandleIndicatorProps) => (
  <span aria-hidden className={cn(indicatorVariants({ variant }), className)} />
);
