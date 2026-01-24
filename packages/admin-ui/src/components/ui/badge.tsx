import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-accent1 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-accent1 text-white',
        secondary: 'border-transparent bg-surface4 text-neutral9',
        destructive: 'border-transparent bg-red-600 text-white',
        outline: 'border-border text-neutral9',
        success: 'border-transparent bg-green-600 text-white',
        warning: 'border-transparent bg-yellow-600 text-white',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
