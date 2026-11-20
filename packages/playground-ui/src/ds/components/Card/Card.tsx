import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { surfaceRimFocus } from '@/ds/primitives/form-element';
import { illustrationPlateStyle } from '@/ds/primitives/illustration-plate';
import { raisedSurfaceStyle, surfaceStateLayerStyle } from '@/ds/primitives/raised-surface';
import { focusRingInset } from '@/ds/primitives/transitions';
import type { LinkComponent } from '@/ds/types/link-component';
import { cn } from '@/lib/utils';

const emphasisOnHover = cn(
  'motion-safe:not-disabled:not-aria-disabled:hover:[&_[data-emphasis=grow-y]]:scale-y-125',
  'motion-safe:not-disabled:not-aria-disabled:hover:[&_[data-emphasis=grow-x]]:scale-x-125',
  'motion-safe:not-disabled:not-aria-disabled:hover:[&_[data-emphasis=pop]]:scale-110',
  'motion-safe:not-disabled:not-aria-disabled:focus-visible:[&_[data-emphasis=grow-y]]:scale-y-125',
  'motion-safe:not-disabled:not-aria-disabled:focus-visible:[&_[data-emphasis=grow-x]]:scale-x-125',
  'motion-safe:not-disabled:not-aria-disabled:focus-visible:[&_[data-emphasis=pop]]:scale-110',
);

const cardVariants = cva(
  cn(raisedSurfaceStyle, 'rounded-xl transition-all duration-normal ease-out-custom motion-reduce:transition-none'),
  {
    variants: {
      elevation: {
        flat: 'shadow-none',
        raised: '',
      },
      interactive: {
        true: cn(
          surfaceStateLayerStyle,
          surfaceRimFocus,
          emphasisOnHover,
          'cursor-pointer active:scale-99 aria-[current=true]:[--surface-rim:var(--border-focus)]',
        ),
        false: '',
      },
    },
    compoundVariants: [
      {
        elevation: 'flat',
        interactive: true,
        class: cn(
          focusRingInset,
          'aria-[current=true]:outline-1 aria-[current=true]:-outline-offset-1 aria-[current=true]:outline-border-focus aria-[current=true]:outline-solid',
        ),
      },
    ],
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

// Card Header component
export type CardHeaderProps = React.HTMLAttributes<HTMLDivElement>;

export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex flex-col space-y-1.5 px-3 py-1', className)} {...props} />
));
CardHeader.displayName = 'CardHeader';

// Card Title component
export type CardTitleProps = React.HTMLAttributes<HTMLHeadingElement>;

export const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(({ className, ...props }, ref) => (
  <h3 ref={ref} className={cn('text-subheading text-foreground', className)} {...props} />
));
CardTitle.displayName = 'CardTitle';

// Card Description component
export type CardDescriptionProps = React.HTMLAttributes<HTMLParagraphElement>;

export const CardDescription = React.forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-caption text-muted-foreground', className)} {...props} />
  ),
);
CardDescription.displayName = 'CardDescription';

// Card Content component
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

// Card Footer component
export type CardFooterProps = React.HTMLAttributes<HTMLDivElement>;

export const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex items-center p-3 pt-0', className)} {...props} />
));
CardFooter.displayName = 'CardFooter';

export type CardIllustrationTone = 'destructive' | 'warning' | 'info' | 'success';

const illustrationToneClasses = {
  destructive: '[--illustration-accent:var(--destructive-indicator)]',
  warning: '[--illustration-accent:var(--warning-indicator)]',
  info: '[--illustration-accent:var(--info-indicator)]',
  success: '[--illustration-accent:var(--success-indicator)]',
} satisfies Record<CardIllustrationTone, string>;

export type CardIllustrationProps = React.ComponentProps<'div'> & {
  tone?: CardIllustrationTone;
};

export function CardIllustration({ className, tone = 'destructive', ...props }: CardIllustrationProps) {
  return (
    <div
      {...props}
      aria-hidden
      className={cn(
        illustrationPlateStyle,
        illustrationToneClasses[tone],
        'h-20 overflow-hidden [&_[data-emphasis=grow-x]]:origin-left [&_[data-emphasis=grow-y]]:origin-bottom [&_[data-emphasis]]:transition-transform [&_[data-emphasis]]:duration-normal [&_[data-emphasis]]:ease-out-custom',
        className,
      )}
    />
  );
}

export type CardInsetProps = React.HTMLAttributes<HTMLElement> & {
  as?: React.ElementType;
};

export const CardInset = React.forwardRef<HTMLElement, CardInsetProps>(
  ({ className, as: Component = 'div', ...props }, ref) => (
    <Component
      ref={ref}
      className={cn(
        'divide-y divide-border overflow-hidden rounded-lg border border-border bg-sidebar *:p-3',
        className,
      )}
      {...props}
    />
  ),
);
CardInset.displayName = 'CardInset';
