import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import React from 'react';

import { Icon } from '../../icons/Icon';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex w-fit max-w-full shrink-0 items-center rounded-full border font-mono', {
  variants: {
    variant: {
      default: 'border-border1 bg-surface4 text-neutral5',
      success: 'border-notice-success/20 bg-notice-success/20 text-notice-success-fg',
      error: 'border-notice-destructive/20 bg-notice-destructive/20 text-notice-destructive-fg',
      info: 'border-notice-info/20 bg-notice-info/20 text-notice-info-fg',
      warning: 'border-notice-warning/20 bg-notice-warning/20 text-notice-warning-fg',
    },
    size: {
      md: 'h-badge-default gap-1 text-ui-sm',
      sm: 'h-form-xs gap-1 text-ui-xs',
      xs: 'h-5 gap-0.5 text-ui-xs',
    },
    withIcon: {
      true: '',
      false: '',
    },
  },
  compoundVariants: [
    { size: 'md', withIcon: false, className: 'px-2.5' },
    { size: 'md', withIcon: true, className: 'pl-2 pr-2.5' },
    { size: 'sm', withIcon: false, className: 'px-2' },
    { size: 'sm', withIcon: true, className: 'pl-1.5 pr-2' },
    { size: 'xs', withIcon: false, className: 'px-1.5' },
    { size: 'xs', withIcon: true, className: 'pl-1 pr-1.5' },
  ],
  defaultVariants: {
    variant: 'default',
    size: 'md',
    withIcon: false,
  },
});

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, Omit<VariantProps<typeof badgeVariants>, 'withIcon'> {
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export const Badge = ({ icon, variant, size, className, children, ...props }: BadgeProps) => {
  return (
    <div
      className={cn(badgeVariants({ variant, size, withIcon: Boolean(icon) }), transitions.colors, className)}
      {...props}
    >
      {icon && <Icon size="sm">{icon}</Icon>}
      {children}
    </div>
  );
};
