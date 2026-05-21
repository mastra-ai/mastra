import { Radio as RadioPrimitive } from '@base-ui/react/radio';
import { RadioGroup as RadioGroupPrimitive } from '@base-ui/react/radio-group';
import { Circle } from 'lucide-react';
import * as React from 'react';

import { formElementFocus } from '@/ds/primitives/form-element';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

type RadioGroupProps = Omit<RadioGroupPrimitive.Props, 'className'> & {
  className?: string;
};

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(({ className, ...props }, ref) => {
  return <RadioGroupPrimitive ref={ref} className={cn('grid gap-2', className)} {...props} />;
});
RadioGroup.displayName = 'RadioGroup';

type RadioGroupItemProps = Omit<RadioPrimitive.Root.Props, 'className'> & {
  className?: string;
};

const RadioGroupItem = React.forwardRef<HTMLSpanElement, RadioGroupItemProps>(({ className, ...props }, ref) => {
  return (
    <RadioPrimitive.Root
      ref={ref}
      className={cn(
        // Base UI's Radio.Root renders a `<span>` (inline) — unlike Radix's
        // `<button>`. `flex` + `shrink-0` make the sizing/centering classes
        // take effect and keep the control square inside flex rows.
        'flex shrink-0 items-center justify-center',
        'aspect-square h-4 w-4 rounded-full border border-neutral3 text-neutral6',
        'shadow-sm',
        transitions.all,
        'hover:border-neutral5 hover:shadow-md',
        formElementFocus,
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-neutral3 disabled:hover:shadow-sm',
        // Base UI exposes `data-checked`/`data-unchecked` instead of Radix's `data-state`.
        'data-[checked]:border-accent1 data-[checked]:shadow-glow-accent1',
        className,
      )}
      {...props}
    >
      <RadioPrimitive.Indicator
        className={cn(
          'flex items-center justify-center',
          'data-[checked]:animate-in data-[checked]:zoom-in-50 data-[checked]:duration-150',
        )}
      >
        <Circle className="h-2 w-2 fill-accent1 text-accent1" />
      </RadioPrimitive.Indicator>
    </RadioPrimitive.Root>
  );
});
RadioGroupItem.displayName = 'RadioGroupItem';

export { RadioGroup, RadioGroupItem };
