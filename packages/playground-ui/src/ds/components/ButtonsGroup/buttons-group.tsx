import './buttons-group.css';
import * as React from 'react';

import { ControlSizeContext } from '@/ds/primitives/control-size';
import type { ControlSize } from '@/ds/primitives/control-size';
import { cn } from '@/lib/utils';

type Orientation = 'horizontal' | 'vertical';

export type ButtonsGroupProps = React.ComponentPropsWithoutRef<'div'> & {
  orientation?: Orientation;
  /**
   * The rung every segment sits on. The group owns it: a child's own `size` cannot lift a
   * segment off the group's rung, so a group can never render with a step in it.
   */
  size?: ControlSize;
};

export const ButtonsGroup = React.forwardRef<HTMLDivElement, ButtonsGroupProps>(
  ({ children, className, orientation = 'horizontal', size = 'md', ...props }, ref) => {
    return (
      <ControlSizeContext.Provider value={size}>
        <div
          ref={ref}
          role="group"
          data-slot="buttons-group"
          data-orientation={orientation}
          data-size={size}
          className={cn('flex w-fit items-stretch', orientation === 'vertical' ? 'flex-col' : 'flex-row', className)}
          {...props}
        >
          {children}
        </div>
      </ControlSizeContext.Provider>
    );
  },
);
ButtonsGroup.displayName = 'ButtonsGroup';

// No size of its own: a text segment only exists inside a group, and the group sets the
// height. `text-label` is the type role at every rung (see `controlSizeClasses`), so the
// box grows and the type does not.
const buttonsGroupTextClassName = cn(
  'inline-flex items-center justify-center border border-border bg-card text-foreground select-none',
  'shrink-0 gap-[.75em] rounded-full px-[1em] text-label whitespace-nowrap',
  '[&>svg]:size-[1.1em] [&>svg]:opacity-50',
);

export type ButtonsGroupTextProps = React.ComponentPropsWithoutRef<'div'>;

export const ButtonsGroupText = React.forwardRef<HTMLDivElement, ButtonsGroupTextProps>(
  ({ className, ...props }, ref) => {
    return (
      <div ref={ref} data-slot="buttons-group-text" className={cn(buttonsGroupTextClassName, className)} {...props} />
    );
  },
);
ButtonsGroupText.displayName = 'ButtonsGroupText';
