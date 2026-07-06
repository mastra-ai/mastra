import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import React from 'react';

import { Icon } from '../../icons/Icon';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'font-mono inline-flex w-fit min-w-0 max-w-full items-center overflow-hidden rounded-full border',
  {
    variants: {
      variant: {
        default: 'text-neutral5 bg-surface4 border-border1',
        success: 'text-notice-success-fg bg-notice-success/20 border-notice-success/20',
        error: 'text-notice-destructive-fg bg-notice-destructive/20 border-notice-destructive/20',
        info: 'text-notice-info-fg bg-notice-info/20 border-notice-info/20',
        warning: 'text-notice-warning-fg bg-notice-warning/20 border-notice-warning/20',
      },
      size: {
        md: 'h-badge-default text-ui-sm gap-1',
        sm: 'h-form-xs text-ui-xs gap-1',
        xs: 'h-5 text-ui-xs gap-0.5',
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
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, Omit<VariantProps<typeof badgeVariants>, 'withIcon'> {
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

function BadgeContent({ children }: { children: React.ReactNode }) {
  if (React.isValidElement<{ className?: string }>(children) && typeof children.type === 'string') {
    return React.cloneElement(children, {
      className: cn('min-w-0 truncate', children.props.className),
    });
  }

  return <span className="min-w-0 truncate">{children}</span>;
}

export const Badge = ({ icon, variant, size, className, children, ...props }: BadgeProps) => {
  return (
    <div
      className={cn(badgeVariants({ variant, size, withIcon: Boolean(icon) }), transitions.colors, className)}
      {...props}
    >
      {icon && (
        <Icon size="sm" className="shrink-0">
          {icon}
        </Icon>
      )}
      {children !== undefined && children !== null && <BadgeContent>{children}</BadgeContent>}
    </div>
  );
};
