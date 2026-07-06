import { Slider as SliderPrimitive } from '@base-ui/react/slider';

import { cn } from '@/lib/utils';

export type SliderProps = Omit<SliderPrimitive.Root.Props, 'onValueChange' | 'onValueCommitted'> & {
  onValueChange?: (value: number[], eventDetails: SliderPrimitive.Root.ChangeEventDetails) => void;
  onValueCommitted?: (value: number[], eventDetails: SliderPrimitive.Root.CommitEventDetails) => void;
};

function toArray(value: number | readonly number[]): number[] {
  if (typeof value === 'number') {
    return [value];
  }
  return [...value];
}

const Slider = ({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  onValueChange,
  onValueCommitted,
  ...props
}: SliderProps) => {
  const values = (() => {
    if (Array.isArray(value)) {
      return value;
    }
    if (Array.isArray(defaultValue)) {
      return defaultValue;
    }
    return [min];
  })();

  return (
    <SliderPrimitive.Root
      className={cn('w-full', className)}
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      thumbAlignment="edge"
      onValueChange={onValueChange ? (next, details) => onValueChange(toArray(next), details) : undefined}
      onValueCommitted={onValueCommitted ? (next, details) => onValueCommitted(toArray(next), details) : undefined}
      {...props}
    >
      <SliderPrimitive.Control
        className={cn(
          'relative flex w-full touch-none items-center select-none group cursor-pointer',
          'data-[orientation=horizontal]:py-3',
          'data-[orientation=vertical]:px-3 data-[orientation=vertical]:h-full data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col',
          'data-[disabled]:opacity-50 data-[disabled]:pointer-events-none data-[disabled]:cursor-not-allowed',
        )}
      >
        <SliderPrimitive.Track
          className={cn(
            'relative grow overflow-hidden rounded-full bg-neutral6/20 select-none',
            'data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full',
            'data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5',
          )}
        >
          <SliderPrimitive.Indicator
            className={cn(
              'bg-neutral6 select-none',
              'data-[orientation=horizontal]:h-full',
              'data-[orientation=vertical]:w-full',
            )}
          />
        </SliderPrimitive.Track>
        {values.map((_, index) => (
          <SliderPrimitive.Thumb
            key={index}
            index={index}
            className={cn(
              'relative block w-2.5 h-5 shrink-0 rounded-full bg-neutral2 border-2 border-neutral6 outline-hidden select-none',
              'after:absolute after:-inset-2 after:content-[""]',
              'transition-shadow duration-normal',
              'hover:ring-2 hover:ring-neutral6/30',
              'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-neutral6/60',
              'data-[orientation=vertical]:w-5 data-[orientation=vertical]:h-2.5',
              'data-[disabled]:pointer-events-none',
            )}
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
};

export { Slider };
