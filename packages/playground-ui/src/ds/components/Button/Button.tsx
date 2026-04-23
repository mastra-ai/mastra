import React from 'react';
import {
  formElementSizes,
  sharedFormElementStyle,
  sharedFormElementFocusStyle,
  sharedFormElementDisabledStyle,
} from '@/ds/primitives/form-element';
import type { FormElementSize } from '@/ds/primitives/form-element';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  as?: React.ElementType;
  className?: string;
  href?: string;
  to?: string;
  prefetch?: boolean | null;
  children: React.ReactNode;
  size?: FormElementSize;
  variant?: 'default' | 'primary' | 'cta' | 'ghost' | 'inputLike' | 'light' | 'outline' | 'link';
  target?: string;
  type?: 'button' | 'submit' | 'reset';
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

const sizeClasses = {
  sm: `${formElementSizes.sm} text-ui-sm px-[.75em]`,
  md: `${formElementSizes.md} text-ui-md px-[.75em]`,
  default: `${formElementSizes.default} text-ui-md px-[.85em] `,
  lg: `${formElementSizes.lg} text-ui-lg px-[1em] `,
};

// Enhanced variant classes with transitions and subtle interactions
const variantClasses = {
  default: 'bg-surface3 border-2 border-border1 hover:text-neutral6 hover:bg-surface4 active:bg-surface5 text-neutral5',
  primary: 'bg-surface4 border-2 border-border2 hover:text-neutral6 hover:bg-surface5 active:bg-surface6 text-neutral6',
  cta: 'bg-accent1/50 hover:bg-accent1/80 text-neutral5 font-semibold',
  ghost:
    'bg-transparent border-2 border-transparent hover:text-neutral6 hover:bg-surface4 active:bg-surface5 text-neutral4',
  inputLike: sharedFormElementStyle,
  light: '',
  outline: '',
  link: 'inline-flex justify-start rounded-none h-auto px-0 bg-transparent text-neutral3 hover:text-neutral4 gap-1 [&>svg]:mx-0 w-auto [&>svg]:opacity-70',
};

const sharedStyles = cn(
  'flex items-center justify-center gap-[.75em] leading-0 transition-colors duration-200 ease-out-custom rounded-lg',
  '[&>svg]:w-[1.1em] [&>svg]:h-[1.1em] [&>svg]:mx-[-.3em]',
  '[&>svg]:opacity-50 [&:hover>svg]:opacity-100',
  sharedFormElementDisabledStyle,
  sharedFormElementFocusStyle,
);

const variantMap: Record<string, keyof typeof variantClasses> = {
  light: 'default',
  outline: 'default',
};

function resolveVariant(variant: string): keyof typeof variantClasses {
  return variantMap[variant] ?? (variant as keyof typeof variantClasses);
}

export function buttonVariants(options?: {
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  iconOnly?: boolean;
}) {
  const variant = resolveVariant(options?.variant || 'default');
  const size = options?.size || 'default';

  return cn(sharedStyles, sizeClasses[size], variantClasses[variant], options?.iconOnly && '[&>svg]:opacity-75');
}

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

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, as, size = 'default', variant = 'default', disabled, children, ...props }, ref) => {
    const Component = as || 'button';
    const iconOnly = isIconOnly(children);

    return (
      <Component
        ref={ref}
        disabled={disabled}
        className={cn(buttonVariants({ variant, size, iconOnly }), className)}
        {...props}
      >
        {children}
      </Component>
    );
  },
);

Button.displayName = 'Button';
