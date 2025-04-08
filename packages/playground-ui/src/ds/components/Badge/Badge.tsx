import clsx from 'clsx';
import React from 'react';

import { Icon } from '../../icons/Icon';

export interface BadgeProps {
  icon?: React.ReactNode;
  variant?: 'default' | 'success' | 'error' | 'info';
  className?: string;
  children?: React.ReactNode;
}

const variantClasses = {
  default: 'text-icon3',
  success: 'text-accent1',
  error: 'text-accent2',
  info: 'text-accent3',
};

export const Badge = ({ icon, variant = 'default', className, children, ...props }: BadgeProps) => {
  return (
    <div
      className={clsx(
        'bg-surface4 text-ui-sm gap-md h-badge-default inline-flex items-center rounded-md',
        icon ? 'pl-md pr-1.5' : 'px-1.5',
        icon || variant === 'default' ? 'text-icon5' : variantClasses[variant],
        className,
      )}
      {...props}
    >
      {icon && (
        <span className={variantClasses[variant]}>
          <Icon>{icon}</Icon>
        </span>
      )}
      {children}
    </div>
  );
};
