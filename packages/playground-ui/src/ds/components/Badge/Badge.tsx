import type { HTMLAttributes, ReactNode } from 'react';

import { Icon } from '../../icons/Icon';
import { productColors } from '../ProductAvatar/product-identity';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export type BadgeEmphasis = 'strong' | 'subtle';
export type BadgeIndicator = 'dot' | 'pulse';

type BadgeToneStyles = Record<BadgeEmphasis, string> & { indicator: string };

const badgeToneStyles = {
  studio: {
    strong: productColors['studio'],
    subtle: productColors['studio'],
    indicator: 'bg-product-studio-fg',
  },
  server: {
    strong: productColors['server'],
    subtle: productColors['server'],
    indicator: 'bg-product-server-fg',
  },
  observability: {
    strong: productColors['observability'],
    subtle: productColors['observability'],
    indicator: 'bg-product-observability-fg',
  },
  factory: {
    strong: productColors['factory'],
    subtle: productColors['factory'],
    indicator: 'bg-product-factory-fg',
  },
  workers: {
    strong: productColors['workers'],
    subtle: productColors['workers'],
    indicator: 'bg-product-workers-fg',
  },
  'persistent-server': {
    strong: productColors['persistent-server'],
    subtle: productColors['persistent-server'],
    indicator: 'bg-product-persistent-server-fg',
  },
  neutral: {
    strong: 'bg-fill text-badge-neutral-fg',
    subtle: 'bg-fill-subtle text-badge-neutral-fg',
    indicator: 'bg-muted-foreground',
  },
  success: {
    strong: 'bg-badge-green text-badge-green-fg',
    subtle: 'bg-badge-green-muted text-badge-green-fg',
    indicator: 'bg-success-indicator',
  },
  destructive: {
    strong: 'bg-badge-red text-badge-red-fg',
    subtle: 'bg-badge-red-muted text-badge-red-fg',
    indicator: 'bg-destructive-indicator',
  },
  info: {
    strong: 'bg-badge-blue text-badge-blue-fg',
    subtle: 'bg-badge-blue-muted text-badge-blue-fg',
    indicator: 'bg-info-indicator',
  },
  warning: {
    strong: 'bg-badge-yellow text-badge-yellow-fg',
    subtle: 'bg-badge-yellow-muted text-badge-yellow-fg',
    indicator: 'bg-warning-indicator',
  },
  green: {
    strong: 'bg-badge-green text-badge-green-fg',
    subtle: 'bg-badge-green-muted text-badge-green-fg',
    indicator: 'bg-badge-green-dot',
  },
  red: {
    strong: 'bg-badge-red text-badge-red-fg',
    subtle: 'bg-badge-red-muted text-badge-red-fg',
    indicator: 'bg-badge-red-dot',
  },
  yellow: {
    strong: 'bg-badge-yellow text-badge-yellow-fg',
    subtle: 'bg-badge-yellow-muted text-badge-yellow-fg',
    indicator: 'bg-badge-yellow-dot',
  },
  blue: {
    strong: 'bg-badge-blue text-badge-blue-fg',
    subtle: 'bg-badge-blue-muted text-badge-blue-fg',
    indicator: 'bg-badge-blue-dot',
  },
  purple: {
    strong: 'bg-badge-purple text-badge-purple-fg',
    subtle: 'bg-badge-purple-muted text-badge-purple-fg',
    indicator: 'bg-badge-purple-dot',
  },
  orange: {
    strong: 'bg-badge-orange text-badge-orange-fg',
    subtle: 'bg-badge-orange-muted text-badge-orange-fg',
    indicator: 'bg-badge-orange-dot',
  },
  cyan: {
    strong: 'bg-badge-cyan text-badge-cyan-fg',
    subtle: 'bg-badge-cyan-muted text-badge-cyan-fg',
    indicator: 'bg-badge-cyan-dot',
  },
  pink: {
    strong: 'bg-badge-pink text-badge-pink-fg',
    subtle: 'bg-badge-pink-muted text-badge-pink-fg',
    indicator: 'bg-badge-pink-dot',
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
  emphasis = 'strong',
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
        'shadow-inset',
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
