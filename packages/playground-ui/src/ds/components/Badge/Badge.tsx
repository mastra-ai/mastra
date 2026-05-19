import React from 'react';

import { Icon } from '../../icons/Icon';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export interface BadgeProps {
  icon?: React.ReactNode;
  variant?: 'default' | 'success' | 'error' | 'info' | 'warning';
  size?: 'default' | 'sm';
  className?: string;
  children?: React.ReactNode;
}

const variantClasses = {
  default: 'text-neutral5 bg-surface4 border-border1',
  success: 'text-notice-success-fg bg-notice-success/20 border-notice-success/20',
  error: 'text-notice-destructive-fg bg-notice-destructive/20 border-notice-destructive/20',
  info: 'text-notice-info-fg bg-notice-info/20 border-notice-info/20',
  warning: 'text-notice-warning-fg bg-notice-warning/20 border-notice-warning/20',
};

const sizeClasses = {
  default: 'h-badge-default text-ui-sm',
  sm: 'h-5 text-ui-xs',
};

export const Badge = ({ icon, variant = 'default', size = 'default', className, children, ...props }: BadgeProps) => {
  const paddingClass = icon
    ? size === 'sm'
      ? 'pl-1.5 pr-2'
      : 'pl-2 pr-2.5'
    : size === 'sm'
      ? 'px-2'
      : 'px-2.5';

  return (
    <div
      className={cn(
        'font-mono gap-1 inline-flex items-center rounded-full border shrink-0',
        transitions.colors,
        paddingClass,
        sizeClasses[size],
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {icon && <Icon size="sm">{icon}</Icon>}
      {children}
    </div>
  );
};
