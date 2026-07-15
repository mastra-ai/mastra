import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';

import { controlHeight, controlSizeClasses } from '@/ds/primitives/control-size';
import { controlFocusBorderVisible, sharedFormElementDisabledStyle } from '@/ds/primitives/form-element';
import { cn } from '@/lib/utils';

// Adornments for text-mode buttons: gap between icon+label, larger radius, and SVG sizing for
// inline `<svg>` children. Excluded from icon-mode because icon-mode wraps children in `<Icon>`
// (so `[&>svg]` selectors don't match) and uses its own `rounded-full` (circle).
const TEXT_MODE_ADORNMENTS = cn(
  'gap-[.75em] rounded-full',
  '[&>svg]:mx-[-.3em] [&>svg]:size-[1.1em]',
  '[&:hover>svg]:opacity-100 [&>svg]:opacity-50',
);

export const buttonVariants = cva(
  cn(
    'inline-flex cursor-pointer items-center justify-center leading-0',
    'duration-normal transition-all ease-out-custom',
    sharedFormElementDisabledStyle,
    controlFocusBorderVisible,
  ),
  {
    variants: {
      variant: {
        default:
          'border border-border2 bg-surface3 text-neutral6 hover:bg-surface5 hover:text-neutral6 active:bg-surface6',
        primary:
          'border border-transparent bg-neutral6 font-medium text-surface1 hover:bg-neutral6/90 active:bg-neutral6/80',
        ghost:
          'border border-transparent bg-transparent text-neutral4 hover:bg-neutral6/5 hover:text-neutral6 active:bg-neutral6/10',
        outline:
          'border border-border1 bg-transparent text-neutral5 hover:bg-surface3 hover:text-neutral6 active:bg-surface4',
      },
      size: {
        xs: cn(controlSizeClasses.xs, 'px-[.8em]', TEXT_MODE_ADORNMENTS),
        sm: cn(controlSizeClasses.sm, 'px-[.9em]', TEXT_MODE_ADORNMENTS),
        md: cn(controlSizeClasses.md, 'px-[.9em]', TEXT_MODE_ADORNMENTS),
        lg: cn(controlSizeClasses.default, 'px-[1em]', TEXT_MODE_ADORNMENTS),
        // Icon sizes: square dimensions, fully rounded → circle. Active state inherits from variant
        // (e.g. `active:bg-surface5`) — same press feedback as text-mode for consistency.
        'icon-xs': cn(controlHeight.xs, 'w-form-xs rounded-full'),
        'icon-sm': cn(controlHeight.sm, 'w-form-sm rounded-full'),
        'icon-md': cn(controlHeight.md, 'w-form-md rounded-full'),
        'icon-lg': cn(controlHeight.lg, 'w-form-lg rounded-full'),
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);

// Public types derived from cva — single source of truth. Adding a variant or size to
// `buttonVariants` automatically updates these unions.
export type ButtonVariantsProps = VariantProps<typeof buttonVariants>;
export type ButtonVariant = NonNullable<ButtonVariantsProps['variant']>;
export type ButtonSize = NonNullable<ButtonVariantsProps['size']>;
export type IconButtonSize = Extract<ButtonSize, `icon-${string}`>;
export type TextButtonSize = Exclude<ButtonSize, IconButtonSize>;
