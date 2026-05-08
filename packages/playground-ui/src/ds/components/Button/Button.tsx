import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { Icon } from '@/ds/icons/Icon';
import {
  formElementSizes,
  sharedFormElementFocusStyle,
  sharedFormElementDisabledStyle,
} from '@/ds/primitives/form-element';
import { cn } from '@/lib/utils';

// Adornments for text-mode buttons: gap between icon+label, larger radius, and SVG sizing for
// inline `<svg>` children. Excluded from icon-mode because icon-mode wraps children in `<Icon>`
// (so `[&>svg]` selectors don't match) and uses its own `rounded-full` (circle).
const TEXT_MODE_ADORNMENTS = cn(
  'gap-[.75em] rounded-full',
  '[&>svg]:w-[1.1em] [&>svg]:h-[1.1em] [&>svg]:mx-[-.3em]',
  '[&>svg]:opacity-50 [&:hover>svg]:opacity-100',
);

export const buttonVariants = cva(
  cn(
    'inline-flex items-center justify-center leading-0 cursor-pointer',
    'transition-all duration-normal ease-out-custom',
    sharedFormElementDisabledStyle,
    sharedFormElementFocusStyle,
  ),
  {
    variants: {
      variant: {
        default:
          'bg-surface3 border border-border1 hover:bg-surface5 hover:text-neutral6 active:bg-surface6 text-neutral6',
        primary:
          'bg-surface4 border border-border2 hover:bg-surface5 hover:text-neutral6 active:bg-surface6 text-neutral6',
        cta: 'bg-accent1 border border-transparent hover:bg-accent1/90 hover:shadow-glow-accent1 disabled:hover:shadow-none text-surface1 font-medium',
        ghost:
          'bg-transparent border border-transparent hover:bg-surface4 hover:text-neutral6 active:bg-surface5 text-neutral4',
        outline:
          'bg-transparent border border-border1 hover:bg-surface3 hover:text-neutral6 active:bg-surface4 text-neutral5',
        link: 'inline-flex justify-start rounded-none h-auto px-0 bg-transparent text-neutral3 hover:text-neutral4 gap-1 [&>svg]:mx-0 w-auto [&>svg]:opacity-70',
      },
      size: {
        sm: cn(`${formElementSizes.sm} text-ui-sm px-[.9em]`, TEXT_MODE_ADORNMENTS),
        md: cn(`${formElementSizes.md} text-ui-md px-[.9em]`, TEXT_MODE_ADORNMENTS),
        default: cn(`${formElementSizes.default} text-ui-md px-[1em]`, TEXT_MODE_ADORNMENTS),
        lg: cn(`${formElementSizes.lg} text-ui-lg px-[1.15em]`, TEXT_MODE_ADORNMENTS),
        // Icon sizes: square dimensions, fully rounded → circle. Active state inherits from variant
        // (e.g. `active:bg-surface5`) — same press feedback as text-mode for consistency.
        'icon-sm': `${formElementSizes.sm} w-form-sm rounded-full`,
        'icon-md': `${formElementSizes.md} w-form-md rounded-full`,
        'icon-lg': `${formElementSizes.lg} w-form-lg rounded-full`,
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

// Public types derived from cva — single source of truth. Adding a variant or size to
// `buttonVariants` automatically updates these unions.
type ButtonVariantsProps = VariantProps<typeof buttonVariants>;
export type ButtonVariant = NonNullable<ButtonVariantsProps['variant']>;
export type ButtonSize = NonNullable<ButtonVariantsProps['size']>;
export type IconButtonSize = Extract<ButtonSize, `icon-${string}`>;

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'>, ButtonVariantsProps {
  as?: React.ElementType;
  className?: string;
  href?: string;
  to?: string;
  prefetch?: boolean | null;
  children: React.ReactNode;
  tooltip?: React.ReactNode;
  target?: string;
  type?: 'button' | 'submit' | 'reset';
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

// Button's icon-* sizes don't match `<Icon>`'s own size scale (`sm | default | lg`).
const iconChildSizeMap: Record<IconButtonSize, 'sm' | 'default' | 'lg'> = {
  'icon-sm': 'sm',
  'icon-md': 'default',
  'icon-lg': 'lg',
};

// Walks React children, expanding `<></>` fragments so `isIconOnly` can inspect the real
// elements inside. `<Button><><Icon/></></Button>` should still count as icon-only.
function flattenChildren(children: React.ReactNode): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  React.Children.forEach(children, child => {
    if (React.isValidElement<{ children?: React.ReactNode }>(child) && child.type === React.Fragment) {
      result.push(...flattenChildren(child.props.children));
    } else {
      result.push(child);
    }
  });
  return result;
}

// True when every child is a React element (no text/label). Used in text-mode to brighten the
// SVG of label-less buttons so the glyph reads stronger.
function isIconOnly(children: React.ReactNode): boolean {
  const flat = flattenChildren(children);
  return flat.length > 0 && flat.every(child => React.isValidElement(child));
}

// Type guard: narrows `ButtonSize` to `IconButtonSize` so consumers (e.g. `iconChildSizeMap`)
// can index into icon-only structures without a cast.
function isIconButtonSize(size: ButtonSize | null | undefined): size is IconButtonSize {
  return typeof size === 'string' && size.startsWith('icon-');
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, as, size, variant = 'default', disabled, children, tooltip, 'aria-label': ariaLabelProp, ...props },
    ref,
  ) => {
    const Component = as || 'button';
    const iconMode = isIconButtonSize(size);
    const resolvedSize: ButtonSize = size ?? 'default';
    const isLabelless = !iconMode && isIconOnly(children);

    // Icon-only buttons need an a11y label. If a string tooltip is provided, reuse it.
    const ariaLabel = ariaLabelProp ?? ((iconMode || isLabelless) && typeof tooltip === 'string' ? tooltip : undefined);

    const content = iconMode ? <Icon size={iconChildSizeMap[size as IconButtonSize]}>{children}</Icon> : children;

    const button = (
      <Component
        ref={ref}
        disabled={disabled}
        aria-label={ariaLabel}
        className={cn(buttonVariants({ variant, size: resolvedSize }), isLabelless && '[&>svg]:opacity-75', className)}
        {...props}
      >
        {content}
      </Component>
    );

    if (tooltip) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
      );
    }

    return button;
  },
);

Button.displayName = 'Button';
