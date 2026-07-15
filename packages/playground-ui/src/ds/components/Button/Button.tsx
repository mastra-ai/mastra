import React from 'react';
import { buttonVariants } from './button-variants';
import type { ButtonSize, ButtonVariantsProps, IconButtonSize } from './button-variants';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { Icon } from '@/ds/icons/Icon';
import { cn } from '@/lib/utils';

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'>, ButtonVariantsProps {
  as?: React.ElementType;
  className?: string;
  href?: string;
  to?: string;
  prefetch?: boolean | null;
  children: React.ReactNode;
  tooltip?: React.ReactNode;
  /**
   * Keeps a disabled control focusable so keyboard users can discover its tooltip.
   * Activation is blocked and `aria-disabled` replaces the native `disabled` attribute.
   */
  focusableWhenDisabled?: boolean;
  target?: string;
  type?: 'button' | 'submit' | 'reset';
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

// Button's icon-* sizes don't match `<Icon>`'s own size scale (`sm | default | lg`).
const iconChildSizeMap: Record<IconButtonSize, 'sm' | 'default' | 'lg'> = {
  'icon-xs': 'sm',
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
    {
      className,
      as,
      size,
      variant = 'default',
      disabled,
      focusableWhenDisabled,
      children,
      tooltip,
      onClick,
      'aria-label': ariaLabelProp,
      'aria-disabled': ariaDisabledProp,
      ...props
    },
    ref,
  ) => {
    const Component = as || 'button';
    const iconMode = isIconButtonSize(size);
    const resolvedSize: ButtonSize = size ?? 'md';
    const isLabelless = !iconMode && isIconOnly(children);
    const isFocusableDisabled = Boolean(disabled && focusableWhenDisabled);

    // Icon-only buttons need an a11y label. If a string tooltip is provided, reuse it.
    const ariaLabel = ariaLabelProp ?? ((iconMode || isLabelless) && typeof tooltip === 'string' ? tooltip : undefined);

    const content = iconMode ? <Icon size={iconChildSizeMap[size as IconButtonSize]}>{children}</Icon> : children;

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (isFocusableDisabled) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      onClick?.(event);
    };

    const button = (
      <Component
        ref={ref}
        disabled={isFocusableDisabled ? undefined : disabled}
        aria-disabled={isFocusableDisabled ? true : ariaDisabledProp}
        aria-label={ariaLabel}
        onClick={handleClick}
        // Expose the variant so a parent ButtonsGroup can detect FILLED segments in CSS
        // (filled buttons have an opaque background that hides a border seam, so the group
        // paints their divider as an inset box-shadow instead — see buttons-group.tsx).
        data-variant={variant}
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
