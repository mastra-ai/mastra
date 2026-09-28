import type { HTMLAttributes, ReactNode } from 'react';

import { Icon } from '../../icons/Icon';
import { productColors } from '../ProductAvatar/product-identity';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export type BadgeEmphasis = 'default' | 'muted';
export type BadgeIndicator = 'dot' | 'pulse';

type BadgeToneStyles = Record<BadgeEmphasis, string> & { indicator: string };

const badgeToneStyles = {
  studio: {
    default: productColors['studio'],
    muted: productColors['studio'],
    indicator: 'bg-product-studio-fg',
  },
  server: {
    default: productColors['server'],
    muted: productColors['server'],
    indicator: 'bg-product-server-fg',
  },
  observability: {
    default: productColors['observability'],
    muted: productColors['observability'],
    indicator: 'bg-product-observability-fg',
  },
  factory: {
    default: productColors['factory'],
    muted: productColors['factory'],
    indicator: 'bg-product-factory-fg',
  },
  workers: {
    default: productColors['workers'],
    muted: productColors['workers'],
    indicator: 'bg-product-workers-fg',
  },
  'persistent-server': {
    default: productColors['persistent-server'],
    muted: productColors['persistent-server'],
    indicator: 'bg-product-persistent-server-fg',
  },
  neutral: {
    default: 'bg-fill text-badge-neutral-fg',
    muted: 'bg-fill-subtle text-badge-neutral-fg',
    indicator: 'bg-muted-foreground',
  },
  success: {
    default: 'bg-badge-green-bg text-badge-green-fg',
    muted: 'bg-badge-green-bg/60 text-badge-green-fg',
    indicator: 'bg-success-indicator',
  },
  destructive: {
    default: 'bg-badge-red-bg text-badge-red-fg',
    muted: 'bg-badge-red-bg/60 text-badge-red-fg',
    indicator: 'bg-destructive-indicator',
  },
  info: {
    default: 'bg-badge-blue-bg text-badge-blue-fg',
    muted: 'bg-badge-blue-bg/60 text-badge-blue-fg',
    indicator: 'bg-info-indicator',
  },
  warning: {
    default: 'bg-badge-yellow-bg text-badge-yellow-fg',
    muted: 'bg-badge-yellow-bg/60 text-badge-yellow-fg',
    indicator: 'bg-warning-indicator',
  },
  green: {
    default: 'bg-badge-green-bg text-badge-green-fg',
    muted: 'bg-badge-green-bg/60 text-badge-green-fg',
    indicator: 'bg-badge-green',
  },
  red: {
    default: 'bg-badge-red-bg text-badge-red-fg',
    muted: 'bg-badge-red-bg/60 text-badge-red-fg',
    indicator: 'bg-badge-red',
  },
  yellow: {
    default: 'bg-badge-yellow-bg text-badge-yellow-fg',
    muted: 'bg-badge-yellow-bg/60 text-badge-yellow-fg',
    indicator: 'bg-badge-yellow',
  },
  blue: {
    default: 'bg-badge-blue-bg text-badge-blue-fg',
    muted: 'bg-badge-blue-bg/60 text-badge-blue-fg',
    indicator: 'bg-badge-blue',
  },
  purple: {
    default: 'bg-badge-purple-bg text-badge-purple-fg',
    muted: 'bg-badge-purple-bg/60 text-badge-purple-fg',
    indicator: 'bg-badge-purple',
  },
  orange: {
    default: 'bg-badge-orange-bg text-badge-orange-fg',
    muted: 'bg-badge-orange-bg/60 text-badge-orange-fg',
    indicator: 'bg-badge-orange',
  },
  cyan: {
    default: 'bg-badge-cyan-bg text-badge-cyan-fg',
    muted: 'bg-badge-cyan-bg/60 text-badge-cyan-fg',
    indicator: 'bg-badge-cyan',
  },
  pink: {
    default: 'bg-badge-pink-bg text-badge-pink-fg',
    muted: 'bg-badge-pink-bg/60 text-badge-pink-fg',
    indicator: 'bg-badge-pink',
  },
} satisfies Record<string, BadgeToneStyles>;

export type BadgeVariant = keyof typeof badgeToneStyles;

const badgeSizeStyles = {
  xs: {
    badge: 'h-[18px] gap-0.5 text-meta',
    withoutLeadingVisual: 'px-1.5',
    withLeadingVisual: 'pl-1 pr-1.5',
    indicator: 'size-1',
  },
  sm: {
    badge: 'h-5 gap-1 text-meta',
    withoutLeadingVisual: 'px-1.5',
    withLeadingVisual: 'px-1.5',
    indicator: 'size-1',
  },
  md: {
    badge: 'h-5 gap-1 text-column tracking-normal',
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
  variant = 'neutral',
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
        'inline-flex w-fit max-w-full shrink-0 items-center rounded-[7px]',
        'inset-ring-1 inset-ring-current/5',
        'inset-shadow-xs inset-shadow-white/5 dark:inset-shadow-[0_3px_10px_-2px_white] dark:inset-shadow-white/7',
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
      {hasIcon ? <Icon size="xs">{icon}</Icon> : null}
      {children}
    </span>
  );
};
