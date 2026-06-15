import React from 'react';

import { Icon } from '../../icons/Icon';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export interface BadgeProps {
  icon?: React.ReactNode;
  variant?: 'default' | 'success' | 'error' | 'info' | 'warning';
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

export const Badge = ({ icon, variant = 'default', className, children, ...props }: BadgeProps) => {
  return (
    <div
      className={cn(
        'font-mono text-ui-sm gap-1 h-badge-default inline-flex items-center rounded-full border shrink-0',
        transitions.colors,
        icon ? 'pl-2 pr-2.5' : 'px-2.5',
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
