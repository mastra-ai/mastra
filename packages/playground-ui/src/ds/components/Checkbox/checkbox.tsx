import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox';
import { Check, Minus } from 'lucide-react';
import * as React from 'react';

import { formElementFocus } from '@/ds/primitives/form-element';
import { transitions } from '@/ds/primitives/transitions';
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
        className={cn(
          'peer h-4 w-4 shrink-0 rounded-sm border border-neutral3',
          'flex items-center justify-center',
          'shadow-sm',
          transitions.all,
          'hover:border-neutral5 hover:shadow-md',
          formElementFocus,
          // Base UI's Checkbox.Root is a `<span>`, so `:disabled` never matches — target `data-disabled`.
          'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[disabled]:hover:border-neutral3 data-[disabled]:hover:shadow-sm',
          'data-[checked]:bg-accent1 data-[checked]:border-accent1 data-[checked]:text-surface1',
          'data-[indeterminate]:bg-accent1 data-[indeterminate]:border-accent1 data-[indeterminate]:text-surface1',
          'data-[checked]:shadow-glow-accent1 data-[indeterminate]:shadow-glow-accent1',
          className,
        )}
        {...props}
      >
        <CheckboxPrimitive.Indicator
          className={cn(
            'group/checkbox-indicator flex items-center justify-center text-current',
            'data-[checked]:animate-in data-[checked]:zoom-in-50 data-[checked]:duration-150',
            'data-[indeterminate]:animate-in data-[indeterminate]:zoom-in-50 data-[indeterminate]:duration-150',
          )}
        >
          {/* `keepMounted` is false by default, so the indicator only mounts in
              the checked/indeterminate states — pick the icon accordingly. */}
          <CheckboxIndicatorIcon />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
    );
  },
);
Checkbox.displayName = 'Checkbox';

/**
 * Picks the checkmark vs. the dash based on the Indicator's data attributes.
 * The Indicator only renders while checked or indeterminate, so this reads the
 * closest element with a `data-indeterminate` attribute.
 */
function CheckboxIndicatorIcon() {
  return (
    <>
      <Check className="h-3.5 w-3.5 stroke-3 group-data-[indeterminate]/checkbox-indicator:hidden" />
      <Minus className="hidden h-3.5 w-3.5 stroke-3 group-data-[indeterminate]/checkbox-indicator:block" />
    </>
  );
}

export { Checkbox };
export type { CheckboxProps };
