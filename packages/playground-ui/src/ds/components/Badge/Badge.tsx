import React from 'react';

import { Icon } from '../../icons/Icon';
import { cn } from '@/lib/utils';
import { transitions } from '@/ds/primitives/transitions';

export interface BadgeProps {
  icon?: React.ReactNode;
  variant?: 'default' | 'success' | 'error' | 'info' | 'warning';
  className?: string;
  children?: React.ReactNode;
}

const variantClasses = {
  default: 'text-neutral3 bg-surface4',
  success: 'text-accent1 bg-accent1Dark',
  error: 'text-accent2 bg-accent2Dark',
  info: 'text-accent5 bg-accent5Dark',
  warning: 'text-accent6 bg-accent6Dark',
};

const iconClasses = {
  default: 'text-neutral3',
  success: 'text-accent1',
  error: 'text-accent2',
  info: 'text-accent5',
  warning: 'text-accent6',
};

export const Badge = ({ icon, variant = 'default', className, children, ...props }: BadgeProps) => {
  return (
    <div
      className={cn(
        'font-mono text-ui-sm gap-1 h-badge-default inline-flex items-center rounded-md shrink-0',
        transitions.colors,
        icon ? 'pl-1 pr-1.5' : 'px-1.5',
        variant === 'default' && icon ? 'bg-surface4 text-neutral5' : variantClasses[variant],
        className,
      )}
      {...props}
    >
      {icon && (
        <span className={iconClasses[variant]}>
          <Icon>{icon}</Icon>
        </span>
      )}
      {children}
    </div>
  );
};
