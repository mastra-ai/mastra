import '../../../../new-theme.css';
import { Button as BaseButton } from '@base-ui/react/button';
import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { Icon } from '@/ds/icons/Icon';
import { controlHeight, controlSizeClasses } from '@/ds/primitives/control-size';
import {
  controlFocusBorderVisible,
  disabledFilledSurfaceStyle,
  disabledOutlineSurfaceStyle,
  sharedFormElementDisabledStyle,
} from '@/ds/primitives/form-element';
import { cn } from '@/lib/utils';

// Adornments for text-mode buttons: gap between icon+label and larger radius.
// - `[data-slot=button-icon]` styles the `<Icon>` wrapper rendered by the `icon` prop — the only
//   supported way to pair an icon with a label (always on the left, fixed gap).
// - `[&>svg]` only remains for label-less text-mode buttons (e.g. CopyButton) that pass a bare
//   SVG as children.
// Excluded from icon-mode because icon-mode wraps children in `<Icon>` and uses its own
// `rounded-full` (circle).
const TEXT_MODE_ADORNMENTS = cn(
  'gap-[.75em] rounded-full',
  '[&>[data-slot=button-icon]]:-ml-[.3em] [&>[data-slot=button-icon]]:opacity-50',
  '[&:hover>[data-slot=button-icon]]:opacity-100',
  '[&>[data-slot=button-icon]]:transition-opacity [&>[data-slot=button-icon]]:duration-normal',
  '[&>[data-slot=button-icon]]:ease-out-custom motion-reduce:[&>[data-slot=button-icon]]:transition-none',
  '[&>svg]:mx-[-.3em] [&>svg]:size-[1.1em]',
  '[&:hover>svg]:opacity-100 [&>svg]:opacity-50',
  '[&>svg]:transition-opacity [&>svg]:duration-normal [&>svg]:ease-out-custom motion-reduce:[&>svg]:transition-none',
);

// eslint-disable-next-line react-refresh/only-export-components -- exported variant helper is part of Button's public API
export const buttonVariants = cva(
  cn(
    'new-theme inline-flex cursor-pointer items-center justify-center leading-0',
    'transition-[background-color,border-color,color] duration-normal ease-out-custom motion-reduce:transition-none',
    sharedFormElementDisabledStyle,
    controlFocusBorderVisible,
  ),
  {
    variants: {
      variant: {
        default: cn(
          'border border-border bg-foreground/10 font-medium text-foreground not-disabled:hover:bg-foreground/14 not-disabled:active:bg-foreground/18',
          disabledFilledSurfaceStyle,
        ),
        primary: cn(
          'border border-transparent bg-foreground font-medium text-background not-disabled:hover:bg-foreground/75 not-disabled:active:bg-foreground/60',
          'disabled:bg-foreground/45 disabled:text-background/75',
        ),
        destructive: cn(
          'border border-transparent bg-accent2 font-medium text-white not-disabled:hover:bg-accent2/80 not-disabled:active:bg-accent2/70',
          'disabled:bg-accent2/40 disabled:text-white/80',
        ),
        'destructive-ghost': cn(
          'border border-transparent bg-transparent text-accent2 not-disabled:hover:bg-accent2/20 not-disabled:hover:text-accent2 not-disabled:active:bg-accent2/30',
          'disabled:bg-transparent disabled:text-accent2/50',
        ),
        ghost: cn(
          'border border-transparent bg-transparent text-foreground/90 not-disabled:hover:bg-foreground/4 not-disabled:hover:text-foreground not-disabled:active:bg-foreground/10',
          'disabled:bg-transparent',
        ),
        outline: cn(
          'border border-foreground/30 bg-transparent text-foreground not-disabled:hover:border-foreground/45 not-disabled:hover:bg-foreground/4 not-disabled:active:bg-foreground/10',
          disabledOutlineSurfaceStyle,
        ),
      },
      size: {
        xs: cn(controlSizeClasses.xs, 'px-[.8em]', TEXT_MODE_ADORNMENTS),
        sm: cn(controlSizeClasses.sm, 'px-[.9em]', TEXT_MODE_ADORNMENTS),
        md: cn(controlSizeClasses.md, 'px-[.9em]', TEXT_MODE_ADORNMENTS),
        lg: cn(controlSizeClasses.lg, 'px-[1em]', TEXT_MODE_ADORNMENTS),
        // Icon sizes: square dimensions, fully rounded → circle. Active state inherits from variant
        // so icon-mode and text-mode use the same press feedback.
        // `icon-lg` is intentionally 32px (larger than text-mode `lg`, which shares the 28px `md` height).
        'icon-xs': cn(controlHeight.xs, 'w-form-xs rounded-full'),
        'icon-sm': cn(controlHeight.sm, 'w-form-sm rounded-full'),
        'icon-md': cn(controlHeight.md, 'w-form-md rounded-full'),
        'icon-lg': 'size-8 rounded-full',
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
type ButtonVariantsProps = VariantProps<typeof buttonVariants>;
export type ButtonVariant = NonNullable<ButtonVariantsProps['variant']>;
export type ButtonSize = NonNullable<ButtonVariantsProps['size']>;
export type IconButtonSize = Extract<ButtonSize, `icon-${string}`>;
export type TextButtonSize = Exclude<ButtonSize, IconButtonSize>;

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'>, ButtonVariantsProps {
  render?: BaseButton.Props['render'];
  className?: string;
  children: React.ReactNode;
  /** Leading icon, always rendered on the left of the label inside `<Icon>`. Ignored in icon-mode sizes. */
  icon?: React.ReactNode;
  tooltip?: React.ReactNode;
  /** @deprecated Pass the element through `render` instead: `render={<Link href="/x" />}`. */
  as?: React.ElementType;
  /** @deprecated Set it on the element passed to `render`. */
  href?: string;
  /** @deprecated Set it on the element passed to `render`. */
  to?: string;
  /** @deprecated Set it on the element passed to `render`. */
  target?: string;
}

// Button's icon-* sizes don't match `<Icon>`'s own size scale (`sm | default | lg`).
const iconChildSizeMap: Record<IconButtonSize, 'sm' | 'default' | 'lg'> = {
  'icon-xs': 'sm',
  'icon-sm': 'sm',
  'icon-md': 'default',
  'icon-lg': 'lg',
};

// `<Icon>` size for the `icon` prop in text-mode, keyed by button size.
const textIconSizeMap: Record<TextButtonSize, 'sm' | 'default'> = {
  xs: 'sm',
  sm: 'sm',
  md: 'default',
  lg: 'default',
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
// eslint-disable-next-line react-refresh/only-export-components -- shared with Combobox's icon-only trigger
export function isIconButtonSize(size: ButtonSize | null | undefined): size is IconButtonSize {
  return size?.startsWith('icon-') ?? false;
}

export const Button = React.forwardRef<HTMLElement, ButtonProps>(
  (
    {
      className,
      render,
      as: asProp,
      href,
      to,
      target,
      size,
      variant = 'default',
      disabled,
      children,
      icon,
      tooltip,
      'aria-label': ariaLabelProp,
      ...props
    },
    ref,
  ) => {
    const iconMode = isIconButtonSize(size);
    const resolvedSize: ButtonSize = size ?? 'md';
    const isLabelless = !iconMode && isIconOnly(children);

    // Icon-only buttons need an a11y label. If a string tooltip is provided, reuse it.
    const ariaLabel = ariaLabelProp ?? ((iconMode || isLabelless) && typeof tooltip === 'string' ? tooltip : undefined);

    const content = iconMode ? (
      <Icon size={iconChildSizeMap[size]}>{children}</Icon>
    ) : (
      <>
        {icon ? (
          <Icon data-slot="button-icon" size={textIconSizeMap[resolvedSize as TextButtonSize]}>
            {icon}
          </Icon>
        ) : null}
        {children}
      </>
    );

    const sharedProps = {
      disabled,
      'aria-label': ariaLabel,
      // Expose the variant so a parent ButtonsGroup can detect FILLED segments in CSS
      // (filled buttons have an opaque background that hides a border seam, so the group
      // paints their divider as an inset box-shadow instead — see buttons-group.tsx).
      'data-variant': variant,
      className: cn(buttonVariants({ variant, size: resolvedSize }), isLabelless && '[&>svg]:opacity-75', className),
      ...props,
    };

    // The deprecated `as` API keeps its original element path rather than going through
    // Base UI. Routing it through `render` drops props Base UI does not know about — a
    // router link loses its `to` and stops navigating — and Base UI warns that a
    // non-<button> contradicts `nativeButton`.
    const LegacyComponent = render ? undefined : asProp;

    // Only forward what the caller actually set. Passing `href={undefined}` through to a
    // router link overwrites the href that link derives from `to`, leaving an anchor that
    // renders correctly and navigates nowhere.
    const legacyLinkProps = {
      ...(href === undefined ? null : { href }),
      ...(to === undefined ? null : { to }),
      ...(target === undefined ? null : { target }),
    };

    const button = LegacyComponent ? (
      <LegacyComponent ref={ref} {...legacyLinkProps} {...sharedProps}>
        {content}
      </LegacyComponent>
    ) : (
      <BaseButton ref={ref} render={render} {...sharedProps}>
        {content}
      </BaseButton>
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
