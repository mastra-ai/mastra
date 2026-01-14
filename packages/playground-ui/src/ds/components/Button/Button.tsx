import React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  as?: React.ElementType;
  className?: string;
  href?: string;
  to?: string;
  prefetch?: boolean | null;
  children: React.ReactNode;
  size?: 'md' | 'lg';
  variant?: 'default' | 'light' | 'outline' | 'ghost';
  target?: string;
  type?: 'button' | 'submit' | 'reset';
}

const sizeClasses = {
  md: 'h-button-md gap-md',
  lg: 'h-button-lg gap-lg',
};

const variantClasses = {
  default: 'bg-surface2 hover:bg-surface4 text-neutral3 hover:text-neutral6 disabled:opacity-50',
  light: 'bg-surface3 hover:bg-surface5 text-neutral6 disabled:opacity-50',
  outline: 'bg-transparent hover:bg-surface2 text-neutral3 hover:text-neutral6 disabled:opacity-50',
  ghost: 'bg-transparent border-transparent hover:bg-surface2 text-neutral3 hover:text-neutral6 disabled:opacity-50',
};

export function buttonVariants(options?: { variant?: ButtonProps['variant']; size?: ButtonProps['size'] }) {
  const variant = options?.variant || 'default';
  const size = options?.size || 'md';

  return cn(
    'bg-surface2 border border-border1 px-lg text-ui-md inline-flex items-center justify-center rounded-md border',
    variantClasses[variant],
    sizeClasses[size],
  );
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, as, size = 'md', variant = 'default', ...props }, ref) => {
    const Component = as || 'button';

    return (
      <Component
        ref={ref}
        className={cn(
          'bg-surface2 border border-border1 px-lg text-ui-md inline-flex items-center justify-center rounded-md border',
          variantClasses[variant],
          sizeClasses[size],
          className,
          {
            'cursor-not-allowed': props.disabled,
          },
        )}
        {...props}
      />
    );
  },
);

Button.displayName = 'Button';
