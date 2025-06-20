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
  variant?: 'default' | 'light' | 'navItem' | 'activeNavItem' | 'backLink';
}

const sizeClasses = {
  md: 'h-button-md gap-md',
  lg: 'h-button-lg gap-lg',
};

const variantClasses = {
  default: 'bg-surface2 hover:bg-surface4 text-icon3 hover:text-icon6',
  light: 'bg-surface3 hover:bg-surface5 text-icon6',
  navItem: 'border-none px-[1rem] py-[0.75rem] text-icon3 text-[1rem]',
  activeNavItem: 'border-b-2 border-white px-[1rem] py-[0.75rem] text-icon3 text-[1rem]',
  backLink:
    'inline-flex w-auto text-[1rem] items-center py-[0.75rem] group [&>svg]:w-[1em] [&>svg]:h-[1em] gap-2 text-icon3',
};

export const Button = ({ className, as, size = 'md', variant = 'default', ...props }: ButtonProps) => {
  const Component = as || 'button';
  const isSpecial = variant === 'navItem' || variant === 'activeNavItem' || variant === 'backLink';

  return (
    <Component
      className={clsx(
        !isSpecial &&
          'bg-surface2 border-sm border-border1 px-lg text-ui-md inline-flex items-center justify-center rounded-md border',
        variantClasses[variant],
        !isSpecial && sizeClasses[size],
        className,
      )}
      {...props}
    />
  );
};
