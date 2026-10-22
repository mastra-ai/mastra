import { Button as BaseButton } from '@base-ui/react/button';
import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { Icon } from '@/ds/icons/Icon';
import { iconSizeClasses } from '@/ds/icons/icon-size-classes';
import type { IconSize } from '@/ds/icons/icon-size-classes';
import { controlHeight, controlSizeClasses } from '@/ds/primitives/control-size';
import {
  controlFocusBorderVisible,
  raisedControlSurfaceStyle,
  sharedFormElementDisabledStyle,
} from '@/ds/primitives/form-element';
import { controlStateColorTransition, focusRing, focusRingOffset } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

// Text-mode buttons are pills. Each size sets `--button-px`, the label's side padding. The
// icon side gets 2px less, because a glyph draws inside its box: the icon then reads as far
// from the edge as the label does (shadcn's Button uses the same 2px step).
// - `[data-slot=button-icon(-end)]`: the `<Icon>` wrappers the `icon` / `iconEnd` props render.
// - `>svg`: a bare SVG passed as a leading child, before the label.
// A button with no label takes an icon-mode size instead: a fixed square with its own
// `rounded-full`, so it reads as a circle rather than a padded pill (lint rule
// `mastra/icon-button-size`).
const TEXT_MODE_ADORNMENTS = cn(
  'rounded-full px-(--button-px)',
  'has-[>[data-slot=button-icon]]:pl-[calc(var(--button-px)-2px)] has-[>svg]:pl-[calc(var(--button-px)-2px)]',
  'has-[>[data-slot=button-icon-end]]:pr-[calc(var(--button-px)-2px)]',
);

const LINK_LAYOUT = cn(
  'relative size-auto gap-1 rounded-xs px-0 text-label',
  'before:absolute before:-inset-x-2',
  'has-[>[data-slot=button-icon-end]]:pr-0 has-[>[data-slot=button-icon]]:pl-0 has-[>svg]:pl-0',
);

const LINK_LABEL = cn(
  'relative inline-flex items-center gap-1',
  iconSizeClasses.sm,
  '[&>svg]:shrink-0',
  'after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-left after:scale-x-0 after:bg-current',
  'after:transition-transform after:duration-fast after:ease-out-custom motion-reduce:after:transition-none',
);

// An icon is secondary to the label beside it, and on a neutral surface it says so with
// a colour token rather than opacity. Opacity dims against whatever sits behind the
// control, so the same glyph clears contrast on one surface and fails on another, and it
// left icon-only buttons with no hover response at all: only their background moved.
// Filled variants opt out because there the glyph colour carries the meaning.
const NEUTRAL_ICON_STATE = cn(
  '[&_svg]:text-muted-foreground not-disabled:hover:[&_svg]:text-foreground aria-disabled:[&_svg]:text-muted-foreground',
);

// eslint-disable-next-line react-refresh/only-export-components -- exported variant helper is part of Button's public API
export const buttonVariants = cva(
  cn(
    'inline-flex cursor-pointer items-center justify-center',
    controlStateColorTransition,
    sharedFormElementDisabledStyle,
    'aria-disabled:pointer-events-none aria-disabled:cursor-not-allowed aria-disabled:text-muted-foreground',
    controlFocusBorderVisible,
  ),
  {
    variants: {
      variant: {
        // The raised card material, the same one a field wears: a neutral filled control is
        // one material system-wide. No border of its own — the material's rim is its edge,
        // and focus repaints that rim. Inside a ButtonsGroup the group flattens the rim and
        // hands every segment the same 1px border instead (see `buttons-group.css`).
        default: cn(
          'border-0',
          raisedControlSurfaceStyle,
          NEUTRAL_ICON_STATE,
          'disabled:bg-fill-subtle aria-disabled:bg-fill-subtle',
        ),
        // Filled variants take the opaque ladder: their rest fill is a colour, not a rung
        // layered on the surface, so a state that thinned it would let whatever the button
        // covers read through the hover it is meant to answer.
        primary: cn(
          'border border-transparent bg-fill-inverse text-background not-disabled:hover:bg-fill-inverse-hover not-disabled:active:bg-fill-inverse-active',
          focusRingOffset,
          'focus-visible:border-transparent',
          'disabled:bg-fill-inverse-disabled disabled:text-background/75 aria-disabled:bg-fill-inverse-disabled aria-disabled:text-background/75',
        ),
        destructive: cn(
          'border border-transparent bg-fill-destructive text-fill-destructive-foreground not-disabled:hover:bg-fill-destructive-hover not-disabled:active:bg-fill-destructive-active',
          focusRingOffset,
          'focus-visible:border-transparent',
          'disabled:bg-fill-destructive-disabled disabled:text-fill-destructive-disabled-foreground aria-disabled:bg-fill-destructive-disabled aria-disabled:text-fill-destructive-disabled-foreground',
        ),
        'destructive-ghost': cn(
          'border border-transparent bg-transparent text-destructive-foreground not-disabled:hover:bg-destructive-subtle not-disabled:hover:text-destructive-foreground not-disabled:active:bg-destructive-subtle-active',
          'disabled:bg-transparent disabled:text-placeholder aria-disabled:bg-transparent aria-disabled:text-placeholder',
        ),
        ghost: cn(
          'border border-transparent bg-transparent text-muted-foreground not-disabled:hover:bg-fill-subtle not-disabled:hover:text-foreground not-disabled:active:bg-fill',
          'disabled:bg-transparent aria-disabled:bg-transparent',
        ),
        // A persistent neutral fill for selected controls. Match default's borderless
        // box so switching between the raised and subtle surfaces keeps labels in place.
        subtle: cn(
          'border-0 bg-fill-hover text-foreground not-disabled:hover:bg-fill-hover not-disabled:active:bg-fill',
          focusRing,
          'disabled:bg-transparent aria-disabled:bg-transparent',
        ),
        link: cn(
          'border-0 bg-transparent text-muted-foreground not-disabled:hover:text-foreground',
          'not-disabled:hover:[&>[data-slot=button-label]]:after:scale-x-100 not-disabled:hover:[&>[data-slot=button-label]]:after:duration-normal',
          focusRingOffset,
          'disabled:text-placeholder aria-disabled:text-placeholder',
        ),
      },
      size: {
        sm: cn(controlSizeClasses.sm, iconSizeClasses.sm, 'gap-1 [--button-px:.9em]', TEXT_MODE_ADORNMENTS),
        md: cn(controlSizeClasses.md, iconSizeClasses.md, 'gap-1.5 [--button-px:.9em]', TEXT_MODE_ADORNMENTS),
        lg: cn(controlSizeClasses.lg, iconSizeClasses.lg, 'gap-1.5 [--button-px:1em]', TEXT_MODE_ADORNMENTS),
        // Icon sizes: square dimensions, fully rounded → circle. Active state inherits from variant
        // so icon-mode and text-mode use the same press feedback. The glyph is sized by the `Icon`
        // wrapper the component puts around an icon-mode child, keyed off the same scale.
        'icon-sm': cn(controlHeight.sm, 'w-control-sm rounded-full'),
        'icon-md': cn(controlHeight.md, 'w-control-md rounded-full'),
        'icon-lg': cn(controlHeight.lg, 'w-control-lg rounded-full'),
      },
    },
    compoundVariants: [
      { variant: 'link', className: LINK_LAYOUT },
      { variant: 'link', size: ['sm', 'md', 'icon-sm', 'icon-md'], className: 'before:-inset-y-1' },
      { variant: 'link', size: ['lg', 'icon-lg'], className: 'before:-inset-y-1.5' },
    ],
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
  iconEnd?: React.ReactNode;
  tooltip?: React.ReactNode;
  /** Side of the trigger the tooltip opens on. Defaults to `top`. */
  tooltipPosition?: 'top' | 'right' | 'bottom' | 'left';
  /** @deprecated Pass the element through `render` instead: `render={<Link href="/x" />}`. */
  as?: React.ElementType;
  /** @deprecated Set it on the element passed to `render`. */
  href?: string;
  /** @deprecated Set it on the element passed to `render`. */
  to?: string;
  /** @deprecated Set it on the element passed to `render`. */
  target?: string;
  /** @deprecated Set it on the element passed to `render`. */
  prefetch?: boolean | null;
}

// A link is not a button. `render` always entered `BaseButton`, which warns in
// development when the resolved element is not a native button. `nativeButton={false}`
// is the worse fix: Base UI then adds `role="button"` and Enter/Space handling, so a
// screen reader announces a link as a button. Render links directly instead and keep
// `BaseButton` for real buttons.
function isLinkElement(
  element: React.ReactElement,
): element is React.ReactElement<{ href?: unknown; to?: unknown; className?: string }> {
  if (element.type === 'a') return true;
  const { href, to } = element.props as { href?: unknown; to?: unknown };
  return href !== undefined || to !== undefined;
}

function preventLinkActivation(event: React.SyntheticEvent): void {
  event.preventDefault();
  event.stopPropagation();
}

type LinkRenderProps = { href?: string; to?: string; target?: string; className?: string };

// One icon step per control step: a glyph is sized by the rung it sits in, so the
// same nominal size renders the same icon whether it arrives as an icon-mode child,
// the `icon` prop, or a bare SVG.
const iconSizeMap: Record<ButtonSize, IconSize> = {
  sm: 'sm',
  md: 'md',
  lg: 'lg',
  'icon-sm': 'sm',
  'icon-md': 'md',
  'icon-lg': 'lg',
};

function adornmentIconSize(variant: ButtonVariant, size: ButtonSize): IconSize {
  if (variant === 'link') return 'sm';
  return iconSizeMap[size];
}

function ButtonAdornment({ slot, size, children }: { slot: string; size: IconSize; children: React.ReactNode }) {
  if (!children) return undefined;
  return (
    <Icon data-slot={slot} size={size}>
      {children}
    </Icon>
  );
}

function ButtonLabel({ variant, children }: { variant: ButtonVariant; children: React.ReactNode }) {
  if (variant !== 'link') return children;
  return (
    <span data-slot="button-label" className={LINK_LABEL}>
      {children}
    </span>
  );
}

// True when every child is an element (no label text). A text-sized button can still hold
// only an icon when its size is forwarded from a wrapper, and it then needs a name too.
function isIconOnly(children: React.ReactNode): boolean {
  const flat = React.Children.toArray(children);
  return flat.length > 0 && flat.every(child => React.isValidElement(child));
}

// Type guard: narrows `ButtonSize` to `IconButtonSize`, so an icon-mode button can be
// told from a text-mode one without a cast.
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
      prefetch,
      size,
      variant = 'default',
      disabled,
      children,
      icon,
      iconEnd,
      tooltip,
      tooltipPosition,
      'aria-label': ariaLabelProp,
      type,
      ...props
    },
    ref,
  ) => {
    const iconMode = variant !== 'link' && isIconButtonSize(size);
    const resolvedSize: ButtonSize = size ?? 'md';
    const resolvedVariant: ButtonVariant = variant ?? 'default';
    const adornmentSize = adornmentIconSize(resolvedVariant, resolvedSize);

    // Icon-only buttons need an a11y label. If a string tooltip is provided, reuse it.
    const ariaLabel =
      ariaLabelProp ?? ((iconMode || isIconOnly(children)) && typeof tooltip === 'string' ? tooltip : undefined);

    const content = iconMode ? (
      <Icon size={iconSizeMap[resolvedSize]}>{children}</Icon>
    ) : (
      <>
        <ButtonAdornment slot="button-icon" size={adornmentSize}>
          {icon}
        </ButtonAdornment>
        <ButtonLabel variant={resolvedVariant}>{children}</ButtonLabel>
        <ButtonAdornment slot="button-icon-end" size={adornmentSize}>
          {iconEnd}
        </ButtonAdornment>
      </>
    );

    const sharedProps = {
      disabled,
      // Base UI renders `type="button"` when the prop is absent, which would quietly stop
      // a form button that relied on the native `submit` default from submitting. Passing
      // it through, `undefined` included, keeps native semantics: absent stays absent.
      type,
      'aria-label': ariaLabel,
      // Expose the variant so a parent ButtonsGroup can detect FILLED segments in CSS
      // (filled buttons have an opaque background that hides a border seam, so the group
      // paints their divider as an inset box-shadow instead — see buttons-group.css).
      'data-variant': variant,
      // Icon-mode is a square: a group that overrides the rung has to move the width with
      // the height or the circle turns into a pill (see buttons-group.css).
      'data-shape': iconMode ? 'icon' : undefined,
      className: cn(buttonVariants({ variant, size: resolvedSize }), className),
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
      ...(prefetch === undefined ? null : { prefetch }),
    };

    const isLinkVariant = resolvedVariant === 'link';
    const linkHref = href ?? to;
    const linkRenderProps: LinkRenderProps = {
      ...(linkHref === undefined ? null : { href: linkHref }),
      ...(target === undefined ? null : { target }),
    };
    const renderedLink =
      React.isValidElement(render) && isLinkElement(render)
        ? render
        : isLinkVariant
          ? React.createElement('a', linkRenderProps)
          : undefined;
    const renderedLinkProps = renderedLink?.props;
    const disabledHref = renderedLink?.type !== 'a' && renderedLinkProps?.href !== undefined ? '' : undefined;
    const disabledTo = renderedLinkProps?.to !== undefined ? '' : undefined;
    const disabledLinkProps = disabled
      ? {
          ...(isLinkVariant ? null : { href: disabledHref }),
          ...(isLinkVariant ? null : { to: disabledTo }),
          'aria-disabled': true,
          onClick: preventLinkActivation,
          onAuxClick: preventLinkActivation,
          onKeyDown: (event: React.KeyboardEvent) => {
            if (event.key === 'Enter' || event.key === ' ') preventLinkActivation(event);
          },
        }
      : undefined;

    const button = LegacyComponent ? (
      <LegacyComponent ref={ref} {...legacyLinkProps} {...sharedProps}>
        {content}
      </LegacyComponent>
    ) : renderedLink ? (
      React.cloneElement(renderedLink as React.ReactElement<Record<string, unknown>>, {
        ref,
        ...sharedProps,
        disabled: undefined,
        ...disabledLinkProps,
        className: cn(sharedProps.className, renderedLink.props.className),
        children: content,
      })
    ) : (
      <BaseButton ref={ref} render={render} {...sharedProps}>
        {content}
      </BaseButton>
    );

    if (tooltip) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side={tooltipPosition}>{tooltip}</TooltipContent>
        </Tooltip>
      );
    }

    return button;
  },
);

Button.displayName = 'Button';
