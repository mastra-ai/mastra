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
}

const sizeClasses = {
  md: 'h-button-md gap-md',
  lg: 'h-button-lg gap-lg',
};

const variantClasses = {
  default: 'bg-surface2 hover:bg-surface4 text-icon3 hover:text-icon6',
  light: 'bg-surface3 hover:bg-surface5 text-icon6',
};

export const Button = ({ className, as, size = 'md', variant = 'default', ...props }: ButtonProps) => {
  const Component = as || 'button';

  return (
    <Component
      className={clsx(
        'bg-surface2 border-sm border-border1 px-lg text-ui-md inline-flex items-center justify-center rounded-md border',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  );
};
