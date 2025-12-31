import { cn } from '@/lib/utils';
import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  as?: React.ElementType;
  children: React.ReactNode;
  variant?: 'primary' | 'outline' | 'ghost';
  // tiny size is outdated defined only to temporary support legacy usage
  size?: 'tiny' | 'short' | 'default' | 'large';
  isFaded?: boolean;
  className?: string;
}

const sizeStyles = {
  tiny: 'min-h-[1.5rem] text-[0.75rem]',
  short: 'min-h-[2rem] text-[0.875rem]',
  default: 'min-h-[2.5rem] text-[0.875rem]',
  large: 'h-[3rem] text-[1rem] px-[1.25rem] gap-[0.75rem]',
};

const variantStyles = {
  primary: 'bg-ui-primaryBtnBg text-ui-primaryBtnText hover:bg-surface6 leading-[0] font-semibold',
  outline: 'border-[rgba(255,255,255,0.15)]',
  ghost: '',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'outline', isFaded, as, size = 'default', ...props }, ref) => {
    const Component = as || 'button';

    return (
      <Component
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-lg px-[1em] gap-[0.75em] leading-0 border bg-transparent text-[rgba(255,255,255,0.7)] whitespace-nowrap',
          '[&:not(:disabled):hover]:border-[rgba(255,255,255,0.25)] [&:not(:disabled):hover]:text-[rgba(255,255,255,0.9)]',
          '[&>svg]:w-[1em] [&>svg]:h-[1em] [&>svg]:mx-[-0.3em] [&>svg]:opacity-70 [&>svg]:shrink-0',
          'focus:outline-none focus:shadow-[inset_0_0_0_1px_rgba(24,251,111,0.75)]',
          {
            'cursor-not-allowed opacity-50': props.disabled,
            'opacity-40': isFaded,
          },
          sizeStyles[size],
          variantStyles[variant],
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = 'Button';
