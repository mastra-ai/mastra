import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox';
import { Check, Minus } from 'lucide-react';
import * as React from 'react';

import { formElementFocus } from '@/ds/primitives/form-element';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

/**
 * Radix-style tri-state value. Base UI splits this into a strict `checked`
 * boolean plus a separate `indeterminate` boolean — we keep the Radix union
 * here so existing consumers (which pass `checked="indeterminate"`) keep
 * working without changes.
 */
export type CheckedState = boolean | 'indeterminate';

type CheckboxProps = Omit<CheckboxPrimitive.Root.Props, 'className' | 'checked' | 'defaultChecked'> & {
  className?: string;
  checked?: CheckedState;
  defaultChecked?: CheckedState;
};

const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ className, checked, defaultChecked, indeterminate, ...props }, ref) => {
    // Translate the Radix `'indeterminate'` sentinel into Base UI's dedicated
    // `indeterminate` prop while leaving `checked`/`defaultChecked` as booleans.
    const isCheckedIndeterminate = checked === 'indeterminate';
    const isDefaultIndeterminate = defaultChecked === 'indeterminate';

    return (
      <CheckboxPrimitive.Root
        ref={ref}
        checked={isCheckedIndeterminate ? false : checked}
        defaultChecked={isDefaultIndeterminate ? false : defaultChecked}
        indeterminate={indeterminate ?? (isCheckedIndeterminate || isDefaultIndeterminate)}
        className={cn(
          'peer h-4 w-4 shrink-0 rounded-sm border border-neutral3',
          'flex items-center justify-center',
          'shadow-sm',
          transitions.all,
          'hover:border-neutral5 hover:shadow-md',
          formElementFocus,
          'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-neutral3 disabled:hover:shadow-sm',
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
