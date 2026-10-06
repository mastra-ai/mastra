import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import * as React from 'react';
import type { TxtProps } from '../Txt';
import { Txt } from '../Txt';
import { surfaceRimFocus } from '@/ds/primitives/form-element';
import { raisedSurfaceStyle, surfaceStateLayerStyle } from '@/ds/primitives/raised-surface';
import { focusRingInset } from '@/ds/primitives/transitions';
import type { LinkComponent } from '@/ds/types/link-component';
import { cn } from '@/lib/utils';

const cardVariants = cva(
  cn(raisedSurfaceStyle, 'rounded-xl transition-all duration-normal ease-out-custom motion-reduce:transition-none'),
  {
    variants: {
      elevation: {
        flat: 'shadow-none',
        raised: '',
      },
      interactive: {
        true: cn(surfaceStateLayerStyle, surfaceRimFocus, 'cursor-pointer active:scale-99'),
        false: '',
      },
    },
    compoundVariants: [{ elevation: 'flat', interactive: true, class: focusRingInset }],
    defaultVariants: {
      elevation: 'raised',
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
    const Component = as || (interactive ? 'button' : 'div');

    return (
      <Component
        ref={ref}
        type={Component === 'button' ? 'button' : undefined}
        className={cn(cardVariants({ elevation, interactive }), className)}
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

export function CardLink({ className, elevation, LinkComponent: Link = 'a', ...props }: CardLinkProps) {
  return <Link className={cn(cardVariants({ elevation, interactive: true }), className)} {...props} />;
}

export type CardHeaderProps = React.HTMLAttributes<HTMLDivElement>;

export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex flex-col space-y-1.5 px-3 py-1', className)} {...props} />
));
CardHeader.displayName = 'CardHeader';

export type CardTitleProps = React.HTMLAttributes<HTMLHeadingElement> & { as?: TxtProps['as'] };

export const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(({ as = 'h3', ...props }, ref) => (
  <Txt ref={ref} as={as} variant="subheading" tone="ink" {...props} />
));
CardTitle.displayName = 'CardTitle';

export type CardDescriptionProps = React.HTMLAttributes<HTMLParagraphElement> & { as?: TxtProps['as'] };

export const CardDescription = React.forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ as = 'p', ...props }, ref) => <Txt ref={ref} as={as} variant="caption" tone="muted" {...props} />,
);
CardDescription.displayName = 'CardDescription';

const cardContentVariants = cva('', {
  variants: {
    density: {
      default: 'p-3',
      compact: 'p-2',
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

export type CardFooterProps = React.HTMLAttributes<HTMLDivElement>;

export const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex items-center p-3 pt-0', className)} {...props} />
));
CardFooter.displayName = 'CardFooter';
