import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import * as React from 'react';
import type { LinkComponent } from '@/ds/types/link-component';
import { cn } from '@/lib/utils';

const cardVariants = cva(
  // Base styles
  'rounded-lg transition-all duration-normal ease-out-custom motion-reduce:transition-none',
  {
    variants: {
      appearance: {
        outlined: 'border border-gray-alpha-3 bg-background-2',
        surface: 'bg-gray-1',
      },
      elevation: {
        flat: '',
        raised: 'shadow-card',
        elevated: 'shadow-elevated',
      },
      interactive: {
        true: 'cursor-pointer active:scale-99',
        false: '',
      },
    },
    compoundVariants: [
      {
        appearance: 'outlined',
        interactive: true,
        className: 'hover:border-gray-alpha-5 hover:bg-gray-1',
      },
      {
        appearance: 'surface',
        interactive: true,
        className:
          'hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-gray-alpha-5 active:bg-surface-active',
      },
    ],
    defaultVariants: {
      appearance: 'outlined',
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
  ({ className, appearance, elevation, interactive, as, ...props }, ref) => {
    const Component = as || (interactive ? 'button' : 'div');

    return (
      <Component
        ref={ref}
        type={Component === 'button' ? 'button' : undefined}
        className={cn(cardVariants({ appearance, elevation, interactive }), className)}
        {...props}
      />
    );
  },
);
Card.displayName = 'Card';

export type CardLinkProps = Omit<React.ComponentPropsWithoutRef<'a'>, 'href'> &
  Omit<VariantProps<typeof cardVariants>, 'interactive'> & {
    href: string;
    LinkComponent?: LinkComponent;
  };

export function CardLink({ className, appearance, elevation, LinkComponent: Link = 'a', ...props }: CardLinkProps) {
  return <Link className={cn(cardVariants({ appearance, elevation, interactive: true }), className)} {...props} />;
}

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
    className={cn('text-ui-md leading-none font-semibold tracking-tight text-gray-10', className)}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

// Card Description component
export type CardDescriptionProps = React.HTMLAttributes<HTMLParagraphElement>;

export const CardDescription = React.forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className, ...props }, ref) => <p ref={ref} className={cn('text-ui-sm text-gray-9', className)} {...props} />,
);
CardDescription.displayName = 'CardDescription';

// Card Content component
const cardContentVariants = cva('', {
  variants: {
    density: {
      default: 'p-4',
      compact: 'p-3',
    },
  },
  defaultVariants: {
    density: 'default',
  },
});

export type CardContentProps = React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof cardContentVariants>;

export const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, density, ...props }, ref) => (
    <div ref={ref} className={cn(cardContentVariants({ density }), className)} {...props} />
  ),
);
CardContent.displayName = 'CardContent';

// Card Footer component
export type CardFooterProps = React.HTMLAttributes<HTMLDivElement>;

export const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex items-center p-4 pt-0', className)} {...props} />
));
CardFooter.displayName = 'CardFooter';
