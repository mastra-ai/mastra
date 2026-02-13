import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';

import { cn } from '@/lib/utils';
import { formElementFocus } from '@/ds/primitives/form-element';
import { transitions } from '@/ds/primitives/transitions';

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn('relative flex w-full touch-none select-none items-center group', className)}
    {...props}
  >
    <SliderPrimitive.Track
      className={cn('relative h-1.5 w-full grow overflow-hidden rounded-full bg-neutral2', transitions.colors)}
    >
      <SliderPrimitive.Range className={cn('absolute h-full bg-accent1', transitions.all)} />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      className={cn(
        'block h-4 w-4 rounded-full border-2 border-accent1 bg-white shadow-md',
        'transition-all duration-normal ease-out-custom',
        formElementFocus,
        'hover:scale-110 hover:shadow-lg',
        'active:scale-95',
        'disabled:pointer-events-none disabled:opacity-50',
      )}
    />
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
