import * as React from 'react';
import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const statusBadgeVariants = cva(
  // Base styles
  'inline-flex items-center gap-1.5 rounded-full text-ui-xs font-medium transition-colors duration-normal',
  {
    variants: {
      variant: {
        success: 'bg-accent1Dark text-accent1',
        warning: 'bg-accent6Dark text-accent6',
        error: 'bg-accent2Dark text-accent2',
        info: 'bg-accent5Dark text-accent5',
        neutral: 'bg-surface4 text-neutral4',
      },
      size: {
        sm: 'px-1.5 py-0.5 text-ui-xs',
        md: 'px-2 py-1 text-ui-xs',
        lg: 'px-2.5 py-1 text-ui-sm',
      },
      withDot: {
        true: '',
        false: '',
      },
      pulse: {
        true: '',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'neutral',
      size: 'md',
      withDot: false,
      pulse: false,
    },
  },
);

const dotVariants = cva('rounded-full', {
  variants: {
    variant: {
      success: 'bg-accent1',
      warning: 'bg-accent6',
      error: 'bg-accent2',
      info: 'bg-accent5',
      neutral: 'bg-neutral3',
    },
    size: {
      sm: 'w-1 h-1',
      md: 'w-1.5 h-1.5',
      lg: 'w-2 h-2',
    },
    pulse: {
      true: 'animate-pulse',
      false: '',
    },
  },
  defaultVariants: {
    variant: 'neutral',
    size: 'md',
    pulse: false,
  },
});

export type StatusBadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof statusBadgeVariants> & {
    children: React.ReactNode;
  };

export function StatusBadge({ className, variant, size, withDot, pulse, children, ...props }: StatusBadgeProps) {
  return (
    <span className={cn(statusBadgeVariants({ variant, size, withDot, pulse }), className)} {...props}>
      {withDot && <span className={dotVariants({ variant, size, pulse })} />}
      {children}
    </span>
  );
}
