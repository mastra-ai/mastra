import clsx from 'clsx';
import React from 'react';

export interface IconProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  size?: 'default' | 'lg' | 'sm';
}

const sizes = {
  sm: '[&>svg]:h-icon-sm [&>svg]:w-icon-sm',
  default: '[&>svg]:h-icon-default [&>svg]:w-icon-default',
  lg: '[&>svg]:h-icon-lg [&>svg]:w-icon-lg',
};

export const Icon = ({ children, className, size = 'default', ...props }: IconProps) => {
  return (
    <span className={clsx('block', sizes[size], className)} {...props}>
      {children}
    </span>
  );
};
