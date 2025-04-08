import clsx from 'clsx';
import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  as?: React.ElementType;
  className?: string;
  href?: string;
  prefetch?: boolean | null;
  children: React.ReactNode;
}

export const Button = ({ className, as, ...props }: ButtonProps) => {
  const Component = as || 'button';

  return (
    <Component
      className={clsx(
        'bg-surface2 border-sm border-border1 px-lg h-button-default text-ui-md text-icon3 gap-md inline-flex items-center rounded-md border',
        'hover:bg-surface4 hover:text-white',
        className,
      )}
      {...props}
    />
  );
};
