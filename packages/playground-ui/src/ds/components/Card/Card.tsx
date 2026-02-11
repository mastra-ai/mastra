import * as React from 'react';
import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const cardVariants = cva(
  // Base styles
  'rounded-lg border border-border1 bg-surface2 transition-all duration-normal ease-out-custom',
  {
    variants: {
      elevation: {
        flat: '',
        raised: 'shadow-card',
        elevated: 'shadow-elevated',
      },
      interactive: {
        true: 'cursor-pointer hover:border-border2 hover:bg-surface3 active:scale-[0.99]',
        false: '',
      },
    },
    defaultVariants: {
      elevation: 'flat',
      interactive: false,
    },
  },
);

export type CardProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof cardVariants> & {
    as?: React.ElementType;
  };

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, elevation, interactive, as, ...props }, ref) => {
    const Component = as || 'div';

    return (
      <Component
        ref={ref}
        className={cn(cardVariants({ elevation, interactive }), className)}
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        {...props}
      />
    );
  },
);
Card.displayName = 'Card';

// Card Header component
export type CardHeaderProps = React.HTMLAttributes<HTMLDivElement>;

export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex flex-col space-y-1.5 p-4 pb-0', className)} {...props} />
));
CardHeader.displayName = 'CardHeader';

// Card Title component
export type CardTitleProps = React.HTMLAttributes<HTMLHeadingElement>;

export const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('text-ui-md font-semibold text-neutral6 leading-none tracking-tight', className)}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

// Card Description component
export type CardDescriptionProps = React.HTMLAttributes<HTMLParagraphElement>;

export const CardDescription = React.forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className, ...props }, ref) => <p ref={ref} className={cn('text-ui-sm text-neutral3', className)} {...props} />,
);
CardDescription.displayName = 'CardDescription';

// Card Content component
export type CardContentProps = React.HTMLAttributes<HTMLDivElement>;

export const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-4', className)} {...props} />
));
CardContent.displayName = 'CardContent';

// Card Footer component
export type CardFooterProps = React.HTMLAttributes<HTMLDivElement>;

export const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex items-center p-4 pt-0', className)} {...props} />
));
CardFooter.displayName = 'CardFooter';
