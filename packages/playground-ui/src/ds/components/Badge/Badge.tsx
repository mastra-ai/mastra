import type { HTMLAttributes, ReactNode } from 'react';

import { Icon } from '../../icons/Icon';
import { productColors, productSubtleColors } from '../ProductAvatar/product-identity';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export type BadgeEmphasis = 'strong' | 'subtle';
export type BadgeIndicator = 'dot' | 'pulse';

type BadgeToneStyles = Record<BadgeEmphasis, string> & { indicator: string };

const green = {
  strong: 'bg-badge-green-strong text-badge-green-foreground',
  subtle: 'bg-badge-green-subtle text-badge-green-foreground',
  indicator: 'bg-badge-green-indicator',
};
const red = {
  strong: 'bg-badge-red-strong text-badge-red-foreground',
  subtle: 'bg-badge-red-subtle text-badge-red-foreground',
  indicator: 'bg-badge-red-indicator',
};
const yellow = {
  strong: 'bg-badge-yellow-strong text-badge-yellow-foreground',
  subtle: 'bg-badge-yellow-subtle text-badge-yellow-foreground',
  indicator: 'bg-badge-yellow-indicator',
};
const blue = {
  strong: 'bg-badge-blue-strong text-badge-blue-foreground',
  subtle: 'bg-badge-blue-subtle text-badge-blue-foreground',
  indicator: 'bg-badge-blue-indicator',
};

const badgeToneStyles = {
  studio: {
    strong: productColors.studio,
    subtle: productSubtleColors.studio,
    indicator: 'bg-product-studio-foreground',
  },
  server: {
    strong: productColors.server,
    subtle: productSubtleColors.server,
    indicator: 'bg-product-server-foreground',
  },
  observability: {
    strong: productColors.observability,
    subtle: productSubtleColors.observability,
    indicator: 'bg-product-observability-foreground',
  },
  factory: {
    strong: productColors.factory,
    subtle: productSubtleColors.factory,
    indicator: 'bg-product-factory-foreground',
  },
  workers: {
    strong: productColors.workers,
    subtle: productSubtleColors.workers,
    indicator: 'bg-product-workers-foreground',
  },
  'persistent-server': {
    strong: productColors['persistent-server'],
    subtle: productSubtleColors['persistent-server'],
    indicator: 'bg-product-persistent-server-foreground',
  },
  neutral: {
    strong: 'bg-fill text-badge-neutral-foreground',
    subtle: 'bg-fill-subtle text-badge-neutral-foreground',
    indicator: 'bg-muted-foreground',
  },
  success: { ...green, indicator: 'bg-success-indicator' },
  destructive: { ...red, indicator: 'bg-destructive-indicator' },
  info: { ...blue, indicator: 'bg-info-indicator' },
  warning: { ...yellow, indicator: 'bg-warning-indicator' },
  green,
  red,
  yellow,
  blue,
  purple: {
    strong: 'bg-badge-purple-strong text-badge-purple-foreground',
    subtle: 'bg-badge-purple-subtle text-badge-purple-foreground',
    indicator: 'bg-badge-purple-indicator',
  },
  orange: {
    strong: 'bg-badge-orange-strong text-badge-orange-foreground',
    subtle: 'bg-badge-orange-subtle text-badge-orange-foreground',
    indicator: 'bg-badge-orange-indicator',
  },
  cyan: {
    strong: 'bg-badge-cyan-strong text-badge-cyan-foreground',
    subtle: 'bg-badge-cyan-subtle text-badge-cyan-foreground',
    indicator: 'bg-badge-cyan-indicator',
  },
  pink: {
    strong: 'bg-badge-pink-strong text-badge-pink-foreground',
    subtle: 'bg-badge-pink-subtle text-badge-pink-foreground',
    indicator: 'bg-badge-pink-indicator',
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
