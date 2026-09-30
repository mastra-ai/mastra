import { Radio as RadioPrimitive } from '@base-ui/react/radio';
import { RadioGroup as RadioGroupPrimitive } from '@base-ui/react/radio-group';
import * as React from 'react';

import type { ControlSize } from '@/ds/primitives/control-size';
import { controlHeight } from '@/ds/primitives/control-size';
import { raisedSurfaceStyle } from '@/ds/primitives/raised-surface';
import { controlStateColorTransition } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export interface SegmentedControlOption<T extends string = string> {
  value: T;
  /** Visible text, or the accessible name when the control is `iconOnly`. */
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  /** Native tooltip, e.g. to explain why the option is disabled. */
  title?: string;
}

export type SegmentedControlProps<T extends string = string> = {
  value: T;
  onValueChange: (value: T) => void;
  options: ReadonlyArray<SegmentedControlOption<T>>;
  /** Accessible name of the group. */
  'aria-label': string;
  /** The track's outer height matches the control rung, so it lines up with a Button or Select in the same row. */
  size?: ControlSize;
  /** Render only each option's icon; its `label` becomes the accessible name. */
  iconOnly?: boolean;
  disabled?: boolean;
  className?: string;
};

/**
 * A single choice between a few short options, all visible at once. A radio group underneath:
 * one tab stop, arrow keys move the selection. The selected segment is marked by a thumb that
 * slides between segments, so segments keep their natural width.
 */
export function SegmentedControl<T extends string = string>({
  value,
  onValueChange,
  options,
  'aria-label': ariaLabel,
  size = 'md',
  iconOnly = false,
  disabled,
  className,
}: SegmentedControlProps<T>) {
  const itemRefs = React.useRef(new Map<string, HTMLElement>());
  const [thumb, setThumb] = React.useState<{ left: number; width: number } | null>(null);
  // The first placement snaps; only later moves animate.
  const [animate, setAnimate] = React.useState(false);

  React.useLayoutEffect(() => {
    const item = itemRefs.current.get(value);
    if (!item) {
      setThumb(null);
      return;
    }
    const measure = () => setThumb({ left: item.offsetLeft, width: item.offsetWidth });
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    // Labels reflow when fonts load or the text changes; a sibling's resize moves this item too.
    const observer = new ResizeObserver(measure);
    itemRefs.current.forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, [value, options]);

  React.useEffect(() => {
    if (thumb && !animate) setAnimate(true);
  }, [thumb, animate]);

  const handleValueChange = (next: unknown) => {
    const match = options.find(option => option.value === next);
    if (match) onValueChange(match.value);
  };

  return (
    <RadioGroupPrimitive
      value={value}
      onValueChange={handleValueChange}
      disabled={disabled}
      aria-label={ariaLabel}
      data-slot="segmented-control"
      data-size={size}
      className={cn(
        raisedSurfaceStyle,
        'relative inline-flex w-fit shrink-0 items-stretch rounded-full p-0.5',
        // Circular icon segments have no padding of their own to keep them apart.
        iconOnly && 'gap-0.5',
        controlHeight[size],
        'data-[disabled]:opacity-50',
        className,
      )}
    >
      {thumb && (
        <span
          aria-hidden="true"
          data-slot="segmented-control-thumb"
          className={cn(
            'pointer-events-none absolute inset-y-0.5 left-0 rounded-full bg-fill-hover ring-1 ring-border ring-inset',
            animate && 'transition-[transform,width] duration-normal ease-out-custom motion-reduce:transition-none',
          )}
          style={{ width: thumb.width, transform: `translateX(${thumb.left}px)` }}
        />
      )}
      {options.map(option => (
        <RadioPrimitive.Root
          key={option.value}
          ref={element => {
            if (element) itemRefs.current.set(option.value, element);
            else itemRefs.current.delete(option.value);
          }}
          value={option.value}
          disabled={option.disabled}
          title={option.title}
          aria-label={iconOnly ? option.label : undefined}
          data-slot="segmented-control-item"
          className={cn(
            'relative inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-full text-label whitespace-nowrap select-none',
            iconOnly ? 'aspect-square' : 'px-3',
            // A whole disabled group is dimmed on the track; a single disabled option dims itself.
            option.disabled && 'opacity-50',
            '[&_svg]:size-3.5 [&_svg]:shrink-0',
            'text-muted-foreground hover:text-foreground data-[checked]:text-foreground',
            'focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-border-focus',
            'data-[disabled]:cursor-not-allowed data-[disabled]:hover:text-muted-foreground',
            controlStateColorTransition,
          )}
        >
          {option.icon}
          {!iconOnly && option.label}
        </RadioPrimitive.Root>
      ))}
    </RadioGroupPrimitive>
  );
}
