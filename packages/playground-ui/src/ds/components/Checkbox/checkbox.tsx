import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox';
import { Check, Minus } from 'lucide-react';
import * as React from 'react';
import '@/ds/primitives/focus.css';

import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

/** Keeps Radix's controlled indeterminate value compatible with existing consumers. */
export type CheckedState = boolean | 'indeterminate';

type CheckboxProps = Omit<CheckboxPrimitive.Root.Props, 'className' | 'checked'> & {
  className?: string;
  checked?: CheckedState;
};

const Checkbox = React.forwardRef<HTMLSpanElement, CheckboxProps>(
  ({ className, checked, indeterminate, ...props }, ref) => {
    const isCheckedIndeterminate = checked === 'indeterminate';

    return (
      <CheckboxPrimitive.Root
        ref={ref}
        checked={isCheckedIndeterminate ? false : checked}
        indeterminate={indeterminate ?? isCheckedIndeterminate}
        data-slot="checkbox"
        className={cn(
          'peer flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-[0.3125rem]',
          'border border-neutral6/[0.06] bg-neutral6/[0.12] text-surface1',
          transitions.all,
          'hover:border-neutral6/[0.12] hover:bg-neutral6/[0.16]',
          'active:scale-95 active:border-neutral6/[0.18] active:bg-neutral6/[0.18]',
          'ds-focus ds-focus-orbit ds-focus-within',
          'data-[checked]:border-neutral6 data-[checked]:bg-neutral6 data-[checked]:text-surface1',
          'data-[indeterminate]:border-neutral6 data-[indeterminate]:bg-neutral6 data-[indeterminate]:text-surface1',
          'data-[checked]:hover:border-neutral5 data-[checked]:hover:bg-neutral5',
          'data-[indeterminate]:hover:border-neutral5 data-[indeterminate]:hover:bg-neutral5',
          'data-[checked]:active:border-neutral4 data-[checked]:active:bg-neutral4',
          'data-[indeterminate]:active:border-neutral4 data-[indeterminate]:active:bg-neutral4',
          // Base UI renders a span, so :disabled never matches the visible control.
          'data-[disabled]:cursor-not-allowed data-[disabled]:border-neutral6/[0.38] data-[disabled]:bg-neutral6/[0.38] data-[disabled]:hover:border-neutral6/[0.38] data-[disabled]:hover:bg-neutral6/[0.38] data-[disabled]:active:scale-100',
          'data-[disabled]:data-[checked]:border-neutral6/[0.38] data-[disabled]:data-[checked]:bg-neutral6/[0.38] data-[disabled]:data-[checked]:text-neutral6',
          'data-[disabled]:data-[indeterminate]:border-neutral6/[0.38] data-[disabled]:data-[indeterminate]:bg-neutral6/[0.38] data-[disabled]:data-[indeterminate]:text-neutral6',
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

function CheckboxIndicatorIcon() {
  return (
    <>
      <Check
        className={cn(
          'stroke-3.25 size-3 scale-95 transition-[stroke-dashoffset,transform] duration-200 ease-out-custom',
          // The dash exceeds the check path length so the final mark is not clipped.
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
