import type { HTMLAttributes, ReactNode } from 'react';

import { Icon } from '../../icons/Icon';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export type BadgeEmphasis = 'default' | 'muted';
export type BadgeIndicator = 'dot' | 'pulse';

type BadgeToneStyles = Record<BadgeEmphasis, string> & { indicator: string };

const badgeToneStyles = {
  default: {
    default: 'bg-neutral6/5 text-badge-neutral-fg',
    muted: 'bg-neutral6/5 text-badge-neutral-fg',
    indicator: 'bg-neutral3',
  },
  success: {
    default: 'bg-badge-green/20 text-badge-green-fg',
    muted: 'bg-badge-green/10 text-badge-green-fg',
    indicator: 'bg-badge-green',
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
    default: 'bg-badge-purple/20 text-badge-purple-fg',
    muted: 'bg-badge-purple/10 text-badge-purple-fg',
    indicator: 'bg-badge-purple',
  },
  orange: {
    default: 'bg-badge-orange/20 text-badge-orange-fg',
    muted: 'bg-badge-orange/10 text-badge-orange-fg',
    indicator: 'bg-badge-orange',
  },
  cyan: {
    default: 'bg-badge-cyan/20 text-badge-cyan-fg',
    muted: 'bg-badge-cyan/10 text-badge-cyan-fg',
    indicator: 'bg-badge-cyan',
  },
  pink: {
    default: 'bg-badge-pink/20 text-badge-pink-fg',
    muted: 'bg-badge-pink/10 text-badge-pink-fg',
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

type BadgeLeadingVisual = { icon?: ReactNode; indicator?: never } | { icon?: never; indicator?: BadgeIndicator };

export type BadgeProps = HTMLAttributes<HTMLSpanElement> &
  BadgeLeadingVisual & {
    variant?: BadgeVariant;
    emphasis?: BadgeEmphasis;
    size?: BadgeSize;
    children?: ReactNode;
  };

export const Badge = ({
  icon,
  indicator,
  variant = 'default',
  emphasis = 'default',
  size = 'md',
  className,
  children,
  ...props
}: BadgeProps) => {
  const hasIcon = Boolean(icon);
  const withLeadingVisual = hasIcon || indicator !== undefined;
  const sizeStyles = badgeSizeStyles[size];
  const paddingClass = withLeadingVisual ? sizeStyles.withLeadingVisual : sizeStyles.withoutLeadingVisual;

  return (
    <span
      className={cn(
        'inline-flex w-fit max-w-full shrink-0 items-center rounded-[7px] font-medium',
        'inset-ring-1 inset-ring-current/5',
        'inset-shadow-xs inset-shadow-white/5 dark:inset-shadow-[0_3px_10px_-2px_white] dark:inset-shadow-white/7',
        'dark:bg-linear-to-b dark:from-white/3 dark:to-white/0',
        badgeToneStyles[variant][emphasis],
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
            badgeToneStyles[variant].indicator,
            sizeStyles.indicator,
            indicator === 'pulse' && 'motion-safe:animate-pulse motion-reduce:animate-none',
          )}
        />
      ) : null}
      {hasIcon ? <Icon size="sm">{icon}</Icon> : null}
      {children}
    </span>
  );
};
