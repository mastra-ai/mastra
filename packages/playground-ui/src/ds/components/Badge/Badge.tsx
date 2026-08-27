import React from 'react';

import { Icon } from '../../icons/Icon';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export type BadgeEmphasis = 'default' | 'muted';
export type BadgeIndicator = 'dot' | 'pulse';

type BadgeToneStyles = Record<BadgeEmphasis, string> & { indicator: string };

const badgeToneStyles = {
  default: {
    default: 'bg-surface4 text-neutral5',
    muted: 'bg-neutral6/5 text-neutral3',
    indicator: 'bg-neutral3',
  },
  success: {
    default: 'bg-notice-success/20 text-notice-success-fg',
    muted: 'bg-notice-success/10 text-notice-success-fg',
    indicator: 'bg-accent1',
  },
  error: {
    default: 'bg-notice-destructive/20 text-notice-destructive-fg',
    muted: 'bg-notice-destructive/10 text-notice-destructive-fg',
    indicator: 'bg-accent2',
  },
  info: {
    default: 'bg-notice-info/20 text-notice-info-fg',
    muted: 'bg-notice-info/10 text-notice-info-fg',
    indicator: 'bg-accent5',
  },
  warning: {
    default: 'bg-notice-warning/20 text-notice-warning-fg',
    muted: 'bg-notice-warning/10 text-notice-warning-fg',
    indicator: 'bg-accent6',
  },
  accent: {
    default: 'bg-badge-purple/20 text-badge-purple',
    muted: 'bg-badge-purple/10 text-badge-purple',
    indicator: 'bg-badge-purple',
  },
  orange: {
    default: 'bg-badge-orange/20 text-badge-orange',
    muted: 'bg-badge-orange/10 text-badge-orange',
    indicator: 'bg-badge-orange',
  },
  cyan: {
    default: 'bg-badge-cyan/20 text-badge-cyan',
    muted: 'bg-badge-cyan/10 text-badge-cyan',
    indicator: 'bg-badge-cyan',
  },
  pink: {
    default: 'bg-badge-pink/20 text-badge-pink',
    muted: 'bg-badge-pink/10 text-badge-pink',
    indicator: 'bg-badge-pink',
  },
} satisfies Record<string, BadgeToneStyles>;

export type BadgeVariant = keyof typeof badgeToneStyles;

const badgeSizeStyles = {
  xs: {
    badge: 'h-[18px] gap-0.5 text-ui-xs',
    withoutLeadingVisual: 'px-1.5',
    withLeadingVisual: 'pl-1 pr-1.5',
    indicator: 'size-1',
  },
  sm: {
    badge: 'h-5 gap-1 text-ui-xs',
    withoutLeadingVisual: 'px-1.5',
    withLeadingVisual: 'px-1.5',
    indicator: 'size-1',
  },
  md: {
    badge: 'h-[22px] gap-1 text-ui-sm',
    withoutLeadingVisual: 'px-2',
    withLeadingVisual: 'pl-1.5 pr-2',
    indicator: 'size-1.5',
  },
};

export type BadgeSize = keyof typeof badgeSizeStyles;

type BadgeLeadingVisual = { icon?: React.ReactNode; indicator?: never } | { icon?: never; indicator?: BadgeIndicator };

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  BadgeLeadingVisual & {
    variant?: BadgeVariant;
    emphasis?: BadgeEmphasis;
    size?: BadgeSize;
    children?: React.ReactNode;
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
  const resolvedEmphasis = emphasis ?? 'default';
  const sizeStyles = badgeSizeStyles[size];
  const paddingClass = withLeadingVisual ? sizeStyles.withLeadingVisual : sizeStyles.withoutLeadingVisual;

  return (
    <span
      className={cn(
        'inline-flex w-fit max-w-full shrink-0 items-center rounded-full font-medium',
        badgeToneStyles[resolvedVariant][resolvedEmphasis],
        sizeStyles.badge,
        paddingClass,
        transitions.colors,
        className,
      )}
      {...props}
    >
      {indicator !== undefined ? (
        <span
          aria-hidden="true"
          className={cn(
            'shrink-0 rounded-full',
            badgeToneStyles[resolvedVariant].indicator,
            sizeStyles.indicator,
            indicator === 'pulse' && 'motion-safe:animate-pulse motion-reduce:animate-none',
          )}
        />
      ) : null}
      {icon !== undefined ? <Icon size="sm">{icon}</Icon> : null}
      {children}
    </span>
  );
};
