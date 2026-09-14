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
  const values = Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min];

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
          'group relative flex w-full cursor-pointer touch-none items-center select-none',
          'data-[orientation=horizontal]:py-3',
          'data-[orientation=vertical]:h-full data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col data-[orientation=vertical]:px-3',
          'data-[disabled]:pointer-events-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
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
              'relative block h-5 w-2.5 shrink-0 rounded-full border-2 border-neutral6 bg-neutral2 outline-hidden select-none',
              'after:absolute after:-inset-2 after:content-[""]',
              'duration-normal transition-shadow',
              'hover:ring-2 hover:ring-neutral6/30',
              'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-neutral6/60',
              'data-[orientation=vertical]:h-2.5 data-[orientation=vertical]:w-5',
              'data-[disabled]:pointer-events-none',
            )}
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
};

export { Slider };
