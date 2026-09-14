import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { Icon } from '@/ds/icons/Icon';
import { controlHeight, controlSizeClasses } from '@/ds/primitives/control-size';
import '@/ds/primitives/focus.css';
import { controlFocusStyle, sharedFormElementDisabledStyle } from '@/ds/primitives/form-element';
import { cn } from '@/lib/utils';

// Direct SVG rules support label-less children; icon props use the data-slot wrapper.
const TEXT_MODE_ADORNMENTS = cn(
  'gap-[.75em] rounded-full',
  '[&>[data-slot=button-icon]]:-ml-[.3em] [&>[data-slot=button-icon]]:opacity-50',
  '[&:hover>[data-slot=button-icon]]:opacity-100',
  '[&>[data-slot=button-icon]]:transition-opacity [&>[data-slot=button-icon]]:duration-normal',
  '[&>[data-slot=button-icon]]:ease-out-custom',
  '[&>svg]:mx-[-.3em] [&>svg]:size-[1.1em]',
  '[&:hover>svg]:opacity-100 [&>svg]:opacity-50',
  '[&>svg]:transition-opacity [&>svg]:duration-normal [&>svg]:ease-out-custom',
);

// eslint-disable-next-line react-refresh/only-export-components -- exported variant helper is part of Button's public API
export const buttonVariants = cva(
  cn(
    'inline-flex cursor-pointer items-center justify-center leading-0',
    'transition-all duration-normal ease-out-custom',
    sharedFormElementDisabledStyle,
    controlFocusStyle,
  ),
  {
    variants: {
      variant: {
        default:
          'border border-border2 bg-surface3 text-neutral6 hover:bg-surface5 hover:text-neutral6 active:bg-surface6',
        primary:
          'border border-transparent bg-neutral6 font-medium text-surface1 hover:bg-neutral6/90 active:bg-neutral6/80',
        destructive:
          'border border-transparent bg-accent2 font-medium text-white hover:bg-accent2/90 active:bg-accent2/80',
        'destructive-ghost':
          'border border-transparent bg-transparent text-accent2 hover:bg-accent2/10 hover:text-accent2 active:bg-accent2/15',
        ghost:
          'border border-transparent bg-transparent text-neutral4 hover:bg-neutral6/5 hover:text-neutral6 active:bg-neutral6/10',
        outline:
          'border border-border1 bg-transparent text-neutral5 hover:bg-surface3 hover:text-neutral6 active:bg-surface4',
      },
      size: {
        xs: cn(controlSizeClasses.xs, 'px-[.8em]', TEXT_MODE_ADORNMENTS),
        sm: cn(controlSizeClasses.sm, 'px-[.9em]', TEXT_MODE_ADORNMENTS),
        md: cn(controlSizeClasses.md, 'px-[.9em]', TEXT_MODE_ADORNMENTS),
        lg: cn(controlSizeClasses.lg, 'px-[1em]', TEXT_MODE_ADORNMENTS),
        'icon-xs': cn(controlHeight.xs, 'ds-focus-orbit w-form-xs rounded-full'),
        'icon-sm': cn(controlHeight.sm, 'ds-focus-orbit w-form-sm rounded-full'),
        'icon-md': cn(controlHeight.md, 'ds-focus-orbit w-form-md rounded-full'),
        // Icon lg stays 32px while text lg uses the shared 28px control height.
        'icon-lg': 'ds-focus-orbit size-8 rounded-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);

type ButtonVariantsProps = VariantProps<typeof buttonVariants>;
export type ButtonVariant = NonNullable<ButtonVariantsProps['variant']>;
export type ButtonSize = NonNullable<ButtonVariantsProps['size']>;
export type IconButtonSize = Extract<ButtonSize, `icon-${string}`>;
export type TextButtonSize = Exclude<ButtonSize, IconButtonSize>;

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'>, ButtonVariantsProps {
  as?: React.ElementType;
  className?: string;
  href?: string;
  to?: string;
  prefetch?: boolean | null;
  children: React.ReactNode;
  /** Rendered before the label; ignored for icon-* sizes. */
  icon?: React.ReactNode;
  tooltip?: React.ReactNode;
  target?: string;
  type?: 'button' | 'submit' | 'reset';
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

const iconChildSizeMap: Record<IconButtonSize, 'sm' | 'default' | 'lg'> = {
  'icon-xs': 'sm',
  'icon-sm': 'sm',
  'icon-md': 'default',
  'icon-lg': 'lg',
};

const textIconSizeMap: Record<TextButtonSize, 'sm' | 'default'> = {
  xs: 'sm',
  sm: 'sm',
  md: 'default',
  lg: 'default',
};

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

function isIconOnly(children: React.ReactNode): boolean {
  const flat = flattenChildren(children);
  return flat.length > 0 && flat.every(child => React.isValidElement(child));
}

// eslint-disable-next-line react-refresh/only-export-components -- shared with Combobox's icon-only trigger
export function isIconButtonSize(size: ButtonSize | null | undefined): size is IconButtonSize {
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
      children,
      icon,
      tooltip,
      'aria-label': ariaLabelProp,
      ...props
    },
    ref,
  ) => {
    const Component = as || 'button';
    const iconMode = isIconButtonSize(size);
    const resolvedSize: ButtonSize = size ?? 'md';
    const isLabelless = !iconMode && isIconOnly(children);

    const ariaLabel = ariaLabelProp ?? ((iconMode || isLabelless) && typeof tooltip === 'string' ? tooltip : undefined);

    const content = isIconButtonSize(resolvedSize) ? (
      <Icon size={iconChildSizeMap[resolvedSize]}>{children}</Icon>
    ) : (
      <>
        {icon ? (
          <Icon data-slot="button-icon" size={textIconSizeMap[resolvedSize]}>
            {icon}
          </Icon>
        ) : null}
        {children}
      </>
    );

    // ButtonsGroup reads data-variant to draw dividers through opaque button backgrounds.
    const button = (
      <Component
        ref={ref}
        disabled={disabled}
        aria-label={ariaLabel}
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
