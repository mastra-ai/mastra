import clsx from 'clsx';
import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  as?: React.ElementType;
  className?: string;
  href?: string;
  to?: string;
  prefetch?: boolean | null;
  children: React.ReactNode;
  size?: 'md' | 'lg';
  variant?: 'default' | 'light';
  target?: string;
  type?: 'button' | 'submit' | 'reset';
}

const sizeClasses = {
  md: 'h-button-md gap-md',
  lg: 'h-button-lg gap-lg',
};

const variantClasses = {
  default: 'bg-surface2 hover:bg-surface4 text-icon3 hover:text-icon6 disabled:opacity-50',
  light: 'bg-surface3 hover:bg-surface5 text-icon6 disabled:opacity-50',
};

export function buttonVariants(options?: {
  variant?: ButtonProps['variant'] | 'outline' | 'ghost';
  size?: ButtonProps['size'];
}) {
  // Map old variants to new ones
  let variant: ButtonProps['variant'] = 'default';
  if (options?.variant === 'light' || options?.variant === 'default') {
    variant = options.variant;
  }
  const size = options?.size || 'md';

  return clsx(
    'bg-surface2 border-sm border-border1 px-lg text-ui-md inline-flex items-center justify-center rounded-md border',
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
        className={clsx(
          'bg-surface2 border-sm border-border1 px-lg text-ui-md inline-flex items-center justify-center rounded-md border',
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
