import React from 'react';
import { cn } from '@/lib/utils';
import { formElementSizes, formElementFocus, type FormElementSize } from '@/ds/primitives/form-element';
import { Icon } from '@/ds/icons/Icon';
import { Tooltip, TooltipContent, TooltipTrigger } from '../Tooltip';

export interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  children: React.ReactNode;
  tooltip: React.ReactNode;
  size?: FormElementSize;
  variant?: 'default' | 'light' | 'outline' | 'ghost' | 'primary';
}

const sizeClasses = {
  sm: `${formElementSizes.sm} w-form-sm`,
  md: `${formElementSizes.md} w-form-md`,
  lg: `${formElementSizes.lg} w-form-lg`,
  default: `${formElementSizes.default}`,
};

const iconSizeMap = {
  sm: 'sm',
  md: 'default',
  lg: 'lg',
  default: 'default',
} as const;

const variantClasses = {
  default:
    'bg-surface2 hover:bg-surface4 text-neutral3 hover:text-neutral6 disabled:opacity-50 disabled:cursor-not-allowed',
  light: 'bg-surface3 hover:bg-surface5 text-neutral6 disabled:opacity-50 disabled:cursor-not-allowed',
  outline:
    'bg-transparent hover:bg-surface2 text-neutral3 hover:text-neutral6 disabled:opacity-50 disabled:cursor-not-allowed',
  ghost:
    'bg-transparent border-transparent hover:bg-surface2 text-neutral3 hover:text-neutral6 disabled:opacity-50 disabled:cursor-not-allowed',
  primary:
    'bg-accent1 hover:bg-accent1/90 text-surface1 font-medium hover:shadow-glow-accent1 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none',
};

const baseButtonStyles =
  'border border-border1 inline-flex items-center justify-center rounded-md transition-all duration-normal ease-out-custom active:scale-[0.98]';

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, children, tooltip, size = 'md', variant = 'default', disabled, ...props }, ref) => {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            ref={ref}
            disabled={disabled}
            aria-label={typeof tooltip === 'string' ? tooltip : undefined}
            className={cn(
              baseButtonStyles,
              formElementFocus,
              variantClasses[variant],
              sizeClasses[size],
              disabled && 'active:scale-100',
              className,
            )}
            {...props}
          >
            <Icon size={iconSizeMap[size]}>{children}</Icon>
          </button>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    );
  },
);

IconButton.displayName = 'IconButton';
