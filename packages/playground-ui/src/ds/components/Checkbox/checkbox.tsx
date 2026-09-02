import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox';
import { Check, Minus } from 'lucide-react';
import * as React from 'react';

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
        data-slot="checkbox"
        className={cn(
          'peer flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-[0.3125rem]',
          'border border-gray-alpha-2 bg-gray-alpha-3 text-background-1 outline-hidden',
          transitions.all,
          'hover:border-gray-alpha-3 hover:bg-gray-alpha-4',
          'active:scale-95 active:border-gray-alpha-5 active:bg-gray-alpha-5',
          'focus-visible:border-gray-6 focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-gray-6 focus-visible:outline-solid',
          'data-[checked]:border-gray-10 data-[checked]:bg-gray-10 data-[checked]:text-background-1',
          'data-[indeterminate]:border-gray-10 data-[indeterminate]:bg-gray-10 data-[indeterminate]:text-background-1',
          'data-[checked]:hover:border-gray-6 data-[checked]:hover:bg-gray-9',
          'data-[indeterminate]:hover:border-gray-6 data-[indeterminate]:hover:bg-gray-9',
          'data-[checked]:active:border-gray-8 data-[checked]:active:bg-gray-8',
          'data-[indeterminate]:active:border-gray-8 data-[indeterminate]:active:bg-gray-8',
          // Base UI's Checkbox.Root is a `<span>`, so `:disabled` never matches; target `data-disabled`.
          'data-[disabled]:cursor-not-allowed data-[disabled]:border-gray-alpha-7 data-[disabled]:bg-gray-alpha-7 data-[disabled]:hover:border-gray-alpha-7 data-[disabled]:hover:bg-gray-alpha-7 data-[disabled]:active:scale-100',
          'data-[disabled]:data-[checked]:border-gray-alpha-7 data-[disabled]:data-[checked]:bg-gray-alpha-7 data-[disabled]:data-[checked]:text-gray-10',
          'data-[disabled]:data-[indeterminate]:border-gray-alpha-7 data-[disabled]:data-[indeterminate]:bg-gray-alpha-7 data-[disabled]:data-[indeterminate]:text-gray-10',
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
