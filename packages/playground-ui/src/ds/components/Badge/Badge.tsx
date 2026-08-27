import { cva } from 'class-variance-authority';
import React from 'react';

import { Icon } from '../../icons/Icon';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex w-fit max-w-full shrink-0 items-center rounded-full font-medium transition-colors duration-normal',
  {
    variants: {
      variant: {
        default: 'text-neutral4',
        success: 'text-neutral5',
        error: 'text-neutral5',
        info: 'text-neutral5',
        warning: 'text-neutral5',
        accent: 'text-neutral5',
      },
      emphasis: {
        default: '',
        muted: '',
      },
      size: {
        md: 'h-badge-default gap-1.5 text-ui-sm',
        sm: 'h-form-xs gap-1.5 text-ui-xs',
        xs: 'h-5 gap-1 text-ui-xs',
      },
      withLeadingVisual: {
        true: '',
        false: '',
      },
    },
    compoundVariants: [
      { variant: 'default', emphasis: 'default', className: 'bg-surface4' },
      { variant: 'default', emphasis: 'muted', className: 'bg-surface3 text-neutral3' },
      { variant: 'success', emphasis: 'default', className: 'bg-accent1Dark' },
      { variant: 'success', emphasis: 'muted', className: 'bg-accent1Darker/50' },
      { variant: 'error', emphasis: 'default', className: 'bg-accent2Dark' },
      { variant: 'error', emphasis: 'muted', className: 'bg-accent2Darker/50' },
      { variant: 'info', emphasis: 'default', className: 'bg-accent5Dark' },
      { variant: 'info', emphasis: 'muted', className: 'bg-accent5Darker/50' },
      { variant: 'warning', emphasis: 'default', className: 'bg-accent6Dark' },
      { variant: 'warning', emphasis: 'muted', className: 'bg-accent6Darker/50' },
      { variant: 'accent', emphasis: 'default', className: 'bg-accent3Dark' },
      { variant: 'accent', emphasis: 'muted', className: 'bg-accent3Darker/50' },
      { size: 'md', withLeadingVisual: false, className: 'px-2.5' },
      { size: 'md', withLeadingVisual: true, className: 'pl-2 pr-2.5' },
      { size: 'sm', withLeadingVisual: false, className: 'px-2' },
      { size: 'sm', withLeadingVisual: true, className: 'pl-1.5 pr-2' },
      { size: 'xs', withLeadingVisual: false, className: 'px-1.5' },
      { size: 'xs', withLeadingVisual: true, className: 'pl-1 pr-1.5' },
    ],
    defaultVariants: {
      variant: 'default',
      emphasis: 'default',
      size: 'md',
      withLeadingVisual: false,
    },
  },
);

export type BadgeVariant = 'default' | 'success' | 'error' | 'info' | 'warning' | 'accent';
export type BadgeEmphasis = 'default' | 'muted';
export type BadgeSize = 'xs' | 'sm' | 'md';
export type BadgeIndicator = 'dot' | 'pulse';

type BadgeLeadingVisual = { icon?: React.ReactNode; indicator?: never } | { icon?: never; indicator?: BadgeIndicator };

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  BadgeLeadingVisual & {
    variant?: BadgeVariant;
    emphasis?: BadgeEmphasis;
    size?: BadgeSize;
    children?: React.ReactNode;
  };

const indicatorSizes: Record<BadgeSize, string> = {
  xs: 'size-1',
  sm: 'size-1',
  md: 'size-1.5',
};

const indicatorColors: Record<BadgeVariant, string> = {
  default: 'bg-neutral3',
  success: 'bg-accent1',
  error: 'bg-accent2',
  info: 'bg-accent5',
  warning: 'bg-accent6',
  accent: 'bg-accent3',
};

export const Badge = ({
  icon,
  indicator,
  variant,
  emphasis,
  size = 'md',
  className,
  children,
  ...props
}: BadgeProps) => {
  const withLeadingVisual = icon !== undefined || indicator !== undefined;
  const resolvedVariant = variant ?? 'default';

  return (
    <span
      className={cn(badgeVariants({ variant, emphasis, size, withLeadingVisual }), transitions.colors, className)}
      {...props}
    >
      {indicator !== undefined ? (
        <span
          aria-hidden="true"
          className={cn(
            'shrink-0 rounded-full',
            indicatorColors[resolvedVariant],
            indicatorSizes[size],
            indicator === 'pulse' && 'motion-safe:animate-pulse motion-reduce:animate-none',
          )}
        />
      ) : null}
      {icon !== undefined ? <Icon size="sm">{icon}</Icon> : null}
      {children}
    </span>
  );
};
