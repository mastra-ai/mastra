import './buttons-group.css';
import { cva } from 'class-variance-authority';
import * as React from 'react';

import { controlSizeClasses } from '@/ds/primitives/control-size';
import type { ControlSize } from '@/ds/primitives/control-size';
import { cn } from '@/lib/utils';

type Orientation = 'horizontal' | 'vertical';

const ButtonsGroupOrientationContext = React.createContext<Orientation>('horizontal');

export type ButtonsGroupProps = React.ComponentPropsWithoutRef<'div'> & {
  orientation?: Orientation;
};

export const ButtonsGroup = React.forwardRef<HTMLDivElement, ButtonsGroupProps>(
  ({ children, className, orientation = 'horizontal', ...props }, ref) => {
    return (
      <ButtonsGroupOrientationContext.Provider value={orientation}>
        <div
          ref={ref}
          role="group"
          data-slot="buttons-group"
          data-orientation={orientation}
          className={cn('flex w-fit items-stretch', orientation === 'vertical' ? 'flex-col' : 'flex-row', className)}
          {...props}
        >
          {children}
        </div>
      </ButtonsGroupOrientationContext.Provider>
    );
  },
);
ButtonsGroup.displayName = 'ButtonsGroup';

export type ButtonsGroupSeparatorProps = React.ComponentPropsWithoutRef<'div'> & {
  orientation?: Orientation;
};

export const ButtonsGroupSeparator = React.forwardRef<HTMLDivElement, ButtonsGroupSeparatorProps>(
  ({ className, orientation, ...props }, ref) => {
    const parentOrientation = React.useContext(ButtonsGroupOrientationContext);
    // Separator runs perpendicular to the group flow by default.
    const resolved = orientation ?? (parentOrientation === 'vertical' ? 'horizontal' : 'vertical');
    return (
      <div
        ref={ref}
        role="separator"
        aria-orientation={resolved}
        data-slot="buttons-group-separator"
        className={cn('self-stretch bg-border', resolved === 'vertical' ? 'w-px' : 'h-px', className)}
        {...props}
      />
    );
  },
);
ButtonsGroupSeparator.displayName = 'ButtonsGroupSeparator';

const buttonsGroupTextVariants = cva(
  cn(
    'inline-flex items-center justify-center border border-border bg-surface-panel text-foreground select-none',
    'shrink-0 gap-[.75em] rounded-full px-[1em] whitespace-nowrap',
    '[&>svg]:size-[1.1em] [&>svg]:opacity-50',
  ),
  {
    variants: {
      size: {
        xs: controlSizeClasses.xs,
        sm: controlSizeClasses.sm,
        md: controlSizeClasses.md,
        lg: controlSizeClasses.lg,
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
);

export type ButtonsGroupTextProps = React.ComponentPropsWithoutRef<'div'> & {
  size?: ControlSize;
};

export const ButtonsGroupText = React.forwardRef<HTMLDivElement, ButtonsGroupTextProps>(
  ({ className, size = 'md', ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="buttons-group-text"
        className={cn(buttonsGroupTextVariants({ size }), className)}
        {...props}
      />
    );
  },
);
ButtonsGroupText.displayName = 'ButtonsGroupText';
