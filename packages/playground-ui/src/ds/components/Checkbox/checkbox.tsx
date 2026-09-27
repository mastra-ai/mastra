import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox';
import { Check, Minus } from 'lucide-react';
import * as React from 'react';

import { selectionControlStyle } from '@/ds/primitives/selection-control';
import { cn } from '@/lib/utils';

/**
 * Radix-style tri-state value for the controlled `checked` prop. Base UI splits
 * this into a strict `checked` boolean plus a separate `indeterminate` boolean —
 * we keep the Radix union here so existing consumers (which pass
 * `checked="indeterminate"`) keep working without changes.
 *
 * `defaultChecked` is intentionally a plain boolean: an uncontrolled checkbox
 * cannot start "indeterminate" and then be toggled out of it (the indeterminate
 * state is inherently controlled), so `'indeterminate'` is not allowed there.
 */
export type CheckedState = boolean | 'indeterminate';

type CheckboxProps = Omit<CheckboxPrimitive.Root.Props, 'className' | 'checked'> & {
  className?: string;
  checked?: CheckedState;
};

const Checkbox = React.forwardRef<HTMLSpanElement, CheckboxProps>(
  ({ className, checked, indeterminate, ...props }, ref) => {
    // Translate the Radix `'indeterminate'` sentinel into Base UI's dedicated
    // `indeterminate` prop while leaving `checked` as a boolean.
    const isCheckedIndeterminate = checked === 'indeterminate';

    return (
      <CheckboxPrimitive.Root
        ref={ref}
        checked={isCheckedIndeterminate ? false : checked}
        indeterminate={indeterminate ?? isCheckedIndeterminate}
        data-slot="checkbox"
        className={cn(
          'peer rounded-[0.3125rem]',
          selectionControlStyle,
          // Indeterminate is checkbox-only and mirrors the checked chip.
          'data-[indeterminate]:border-foreground data-[indeterminate]:bg-foreground data-[indeterminate]:text-background',
          'data-[indeterminate]:hover:border-foreground/90 data-[indeterminate]:hover:bg-foreground/90',
          'data-[indeterminate]:active:border-foreground/75 data-[indeterminate]:active:bg-foreground/75',
          'data-[disabled]:data-[indeterminate]:border-muted-foreground data-[disabled]:data-[indeterminate]:bg-muted-foreground data-[disabled]:data-[indeterminate]:text-background',
          className,
        )}
        {...props}
      >
        <CheckboxPrimitive.Indicator
          keepMounted
          className={cn(
            'group/checkbox-indicator flex items-center justify-center text-current',
            'scale-75 opacity-0 transition-[opacity,transform] duration-200 ease-out-custom',
            'data-[checked]:scale-100 data-[checked]:opacity-100',
            'data-[indeterminate]:scale-100 data-[indeterminate]:opacity-100',
            'data-[starting-style]:scale-75 data-[starting-style]:opacity-0',
            'data-[ending-style]:scale-75 data-[ending-style]:opacity-0',
          )}
        >
          <CheckboxIndicatorIcon />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
    );
  },
);
Checkbox.displayName = 'Checkbox';

/**
 * Picks the checkmark vs. the dash based on the Indicator's data attributes.
 * The Indicator stays mounted so unchecked transitions can animate out cleanly.
 */
function CheckboxIndicatorIcon() {
  return (
    <>
      <Check
        className={cn(
          'stroke-3.25 size-3 scale-95 transition-[stroke-dashoffset,transform] duration-200 ease-out-custom',
          // Lucide's check path is ~22.6 units long. Use a longer dash so the
          // final checked mark is never clipped.
          '[stroke-dasharray:28] [stroke-dashoffset:28]',
          'group-data-[checked]/checkbox-indicator:[stroke-dashoffset:0]',
          'group-data-[checked]/checkbox-indicator:scale-100',
          'group-data-[indeterminate]/checkbox-indicator:hidden',
        )}
      />
      <Minus
        className={cn(
          'stroke-3.25 hidden size-3 scale-95 transition-transform duration-200 ease-out-custom',
          'group-data-[indeterminate]/checkbox-indicator:block',
          'group-data-[indeterminate]/checkbox-indicator:scale-100',
        )}
      />
    </>
  );
}

export { Checkbox };
export type { CheckboxProps };
