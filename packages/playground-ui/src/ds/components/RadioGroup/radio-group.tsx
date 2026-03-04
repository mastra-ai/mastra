import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { Circle } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';
import { formElementFocus } from '@/ds/primitives/form-element';
import { transitions } from '@/ds/primitives/transitions';

const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => {
  return <RadioGroupPrimitive.Root className={cn('grid gap-2', className)} {...props} ref={ref} />;
});
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;

const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        'aspect-square h-4 w-4 rounded-full border border-neutral3 text-neutral6',
        'shadow-sm',
        transitions.all,
        'hover:border-neutral5 hover:shadow-md',
        formElementFocus,
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-neutral3 disabled:hover:shadow-sm',
        'data-[state=checked]:border-accent1 data-[state=checked]:shadow-glow-accent1',
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator
        className={cn(
          'flex items-center justify-center',
          'data-[state=checked]:animate-in data-[state=checked]:zoom-in-50 data-[state=checked]:duration-150',
        )}
      >
        <Circle className="h-2 w-2 fill-accent1 text-accent1" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
});
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName;

export { RadioGroup, RadioGroupItem };
