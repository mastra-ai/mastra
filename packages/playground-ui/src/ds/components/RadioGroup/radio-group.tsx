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

const RadioGroupItem = React.forwardRef<HTMLButtonElement, RadioGroupItemProps>(({ className, ...props }, ref) => {
  // Base UI's Radio.Root defaults to a `<span>` and forwards `id` to its
  // hidden radio input. Render a native `<button>` (with `nativeButton`) so
  // the consumer's `id` — and the click target — lands on the visible control,
  // matching the previous Radix behavior and preventing duplicate accessible
  // elements when paired with `<label htmlFor="...">`.
  return (
    <RadioPrimitive.Root
      ref={ref}
      render={<button type="button" />}
      nativeButton
      className={cn(
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
