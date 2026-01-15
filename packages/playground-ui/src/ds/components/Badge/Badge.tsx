import React from 'react';

import { Icon } from '../../icons/Icon';
import { cn } from '@/lib/utils';

export interface BadgeProps {
  icon?: React.ReactNode;
  variant?: 'default' | 'success' | 'error' | 'info';
  className?: string;
  children?: React.ReactNode;
}

const variantClasses = {
  default: 'text-neutral3',
  success: 'text-accent1',
  error: 'text-accent2',
  info: 'text-accent3',
};

export const Badge = ({ icon, variant = 'default', className, children, ...props }: BadgeProps) => {
  return (
    <div
      className={cn(
        'font-mono bg-surface4 text-ui-sm gap-1 h-badge-default inline-flex items-center rounded-md shrink-0',
        icon ? 'pl-1 pr-1.5' : 'px-1.5',
        icon || variant === 'default' ? 'text-neutral5' : variantClasses[variant],
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
