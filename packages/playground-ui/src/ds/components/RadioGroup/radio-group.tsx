import { Radio as RadioPrimitive } from '@base-ui/react/radio';
import { RadioGroup as RadioGroupPrimitive } from '@base-ui/react/radio-group';
import * as React from 'react';

import { selectionControlStyle } from '@/ds/primitives/selection-control';
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
      className={cn('rounded-full', selectionControlStyle, className)}
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
