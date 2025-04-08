import clsx from 'clsx';
import React from 'react';

export interface IconProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  size?: 'default' | 'lg';
}

const sizes = {
  default: '[&>svg]:h-icon-default [&>svg]:w-icon-default',
  lg: '[&>svg]:h-icon-lg [&>svg]:w-icon-lg',
};

export const Icon = ({ children, className, size = 'default', ...props }: IconProps) => {
  return (
    <div className={clsx(sizes[size], className)} {...props}>
      {children}
    </div>
  );
};
