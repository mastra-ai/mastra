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
        'flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-full',
        'border border-neutral6/[0.06] bg-neutral6/[0.12] text-surface1 outline-hidden',
        transitions.all,
        'hover:border-neutral6/[0.12] hover:bg-neutral6/[0.16]',
        'active:scale-95 active:border-neutral6/[0.18] active:bg-neutral6/[0.18]',
        'focus-visible:border-neutral5/50 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-neutral5/55',
        // Base UI exposes `data-checked`/`data-unchecked` instead of Radix's `data-state`.
        'data-[checked]:border-neutral6 data-[checked]:bg-neutral6 data-[checked]:text-surface1',
        'data-[checked]:hover:border-neutral5 data-[checked]:hover:bg-neutral5',
        'data-[checked]:active:border-neutral4 data-[checked]:active:bg-neutral4',
        // Base UI's Radio.Root is a `<span>`, so `:disabled` never matches; target `data-disabled`.
        'data-[disabled]:cursor-not-allowed data-[disabled]:border-neutral6/[0.38] data-[disabled]:bg-neutral6/[0.38] data-[disabled]:hover:border-neutral6/[0.38] data-[disabled]:hover:bg-neutral6/[0.38] data-[disabled]:active:scale-100',
        'data-[disabled]:data-[checked]:border-neutral6/[0.38] data-[disabled]:data-[checked]:bg-neutral6/[0.38] data-[disabled]:data-[checked]:text-neutral6',
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
