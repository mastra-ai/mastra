import React from 'react';
import { cn } from '@/lib/utils';
import {
  formElementSizes,
  sharedFormElementStyle,
  sharedFormElementFocusStyle,
  sharedFormElementDisabledStyle,
  type FormElementSize,
} from '@/ds/primitives/form-element';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  as?: React.ElementType;
  className?: string;
  href?: string;
  to?: string;
  prefetch?: boolean | null;
  children: React.ReactNode;
  size?: FormElementSize;
  variant?: 'default' | 'primary' | 'cta' | 'ghost' | 'inputLike' | 'light' | 'outline';
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
  default:
    'bg-white/10 border-2 border-transparent hover:text-white hover:bg-white/15 active:bg-white/20 text-neutral4',
  primary:
    'bg-white/20 border-2 border-transparent hover:text-white hover:bg-white/25 active:bg-white/30 text-neutral5',
  cta: 'bg-accent1/50 hover:bg-accent1/80 text-neutral5 font-semibold',
  ghost:
    'bg-transparent border-2 border-transparent hover:text-neutral4 hover:bg-white/10 active:bg-white/15 text-neutral3',
  inputLike: sharedFormElementStyle,
  light: '',
  outline: '',
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

  return cn(sharedStyles, variantClasses[variant], sizeClasses[size], options?.iconOnly && '[&>svg]:opacity-75');
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
