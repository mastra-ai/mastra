import { Radio as RadioPrimitive } from '@base-ui/react/radio';
import { RadioGroup as RadioGroupPrimitive } from '@base-ui/react/radio-group';
import * as React from 'react';

import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

type RadioGroupProps = Omit<RadioGroupPrimitive.Props, 'className'> & {
  className?: string;
};

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(({ className, ...props }, ref) => {
  return <RadioGroupPrimitive ref={ref} data-slot="radio-group" className={cn('grid gap-2', className)} {...props} />;
});
RadioGroup.displayName = 'RadioGroup';

type RadioGroupItemProps = Omit<RadioPrimitive.Root.Props, 'className'> & {
  className?: string;
};

const RadioGroupItem = React.forwardRef<HTMLSpanElement, RadioGroupItemProps>(({ className, ...props }, ref) => {
  return (
    <RadioPrimitive.Root
      ref={ref}
      data-slot="radio-group-item"
      className={cn(
        'flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-full',
        'border border-gray-alpha-2 bg-gray-alpha-3 text-background-1 outline-hidden',
        transitions.all,
        'hover:border-gray-alpha-3 hover:bg-gray-alpha-4',
        'active:scale-95 active:border-gray-alpha-5 active:bg-gray-alpha-5',
        'focus-visible:border-gray-6 focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-gray-6 focus-visible:outline-solid',
        // Base UI exposes `data-checked`/`data-unchecked` instead of Radix's `data-state`.
        'data-[checked]:border-gray-10 data-[checked]:bg-gray-10 data-[checked]:text-background-1',
        'data-[checked]:hover:border-gray-6 data-[checked]:hover:bg-gray-9',
        'data-[checked]:active:border-gray-8 data-[checked]:active:bg-gray-8',
        // Base UI's Radio.Root is a `<span>`, so `:disabled` never matches; target `data-disabled`.
        'data-[disabled]:cursor-not-allowed data-[disabled]:border-gray-alpha-7 data-[disabled]:bg-gray-alpha-7 data-[disabled]:hover:border-gray-alpha-7 data-[disabled]:hover:bg-gray-alpha-7 data-[disabled]:active:scale-100',
        'data-[disabled]:data-[checked]:border-gray-alpha-7 data-[disabled]:data-[checked]:bg-gray-alpha-7 data-[disabled]:data-[checked]:text-gray-10',
        className,
      )}
      {...props}
    >
      <RadioPrimitive.Indicator
        keepMounted
        className={cn(
          'flex items-center justify-center text-current',
          'scale-50 opacity-0 transition-[opacity,scale] duration-200 ease-out-custom',
          'data-[checked]:scale-100 data-[checked]:opacity-100',
          'data-[starting-style]:scale-50 data-[starting-style]:opacity-0',
          'data-[ending-style]:scale-50 data-[ending-style]:opacity-0',
        )}
      >
        <span className="size-1.5 rounded-full bg-current" />
      </RadioPrimitive.Indicator>
    </RadioPrimitive.Root>
  );
});
RadioGroupItem.displayName = 'RadioGroupItem';

export { RadioGroup, RadioGroupItem };
