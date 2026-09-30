import { Radio as RadioPrimitive } from '@base-ui/react/radio';
import { RadioGroup as RadioGroupPrimitive } from '@base-ui/react/radio-group';
import * as React from 'react';

import type { ControlSize } from '@/ds/primitives/control-size';
import { controlHeight } from '@/ds/primitives/control-size';
import { raisedSurfaceStyle } from '@/ds/primitives/raised-surface';
import { controlStateColorTransition } from '@/ds/primitives/transitions';
import { mergeRefs } from '@/lib/merge-refs';
import { cn } from '@/lib/utils';

type SegmentedControlContextValue = {
  iconOnly: boolean;
  registerItem: (value: string, element: HTMLElement) => void;
  unregisterItem: (value: string) => void;
};

const SegmentedControlContext = React.createContext<SegmentedControlContextValue | undefined>(undefined);

type RadioGroupPassthroughProps = Omit<
  RadioGroupPrimitive.Props,
  'value' | 'defaultValue' | 'onValueChange' | 'onChange' | 'className' | 'children' | 'aria-label'
>;

export type SegmentedControlProps<T extends string = string> = RadioGroupPassthroughProps & {
  value: T;
  onValueChange: (value: T) => void;
  /** Accessible name of the group. */
  'aria-label': string;
  /** The track's outer height matches the control rung, so it lines up with a Button or Select in the same row. */
  size?: ControlSize;
  /** Every item is a circle holding only an icon; each item then needs its own `aria-label`. */
  iconOnly?: boolean;
  className?: string;
  children: React.ReactNode;
};

/**
 * A single choice between a few short options, all visible at once. A radio group underneath:
 * one tab stop, arrow keys move the selection. The selected item is marked by a thumb that
 * slides between items, so items keep their natural width.
 *
 * ```tsx
 * <SegmentedControl aria-label="Permission" value={policy} onValueChange={setPolicy}>
 *   <SegmentedControlItem value="allow">Allow</SegmentedControlItem>
 *   <SegmentedControlItem value="ask">Ask</SegmentedControlItem>
 * </SegmentedControl>
 * ```
 */
export function SegmentedControl<T extends string = string>({
  value,
  onValueChange,
  'aria-label': ariaLabel,
  size = 'md',
  iconOnly = false,
  className,
  children,
  ...props
}: SegmentedControlProps<T>) {
  const itemRefs = React.useRef(new Map<string, HTMLElement>());
  const thumbRef = React.useRef<HTMLSpanElement>(null);

  const context: SegmentedControlContextValue = {
    iconOnly,
    registerItem: (itemValue, element) => itemRefs.current.set(itemValue, element),
    unregisterItem: itemValue => itemRefs.current.delete(itemValue),
  };

  // Base UI reports the chosen value as `unknown`; accept only a value one of our items carries.
  const isItemValue = (next: unknown): next is T => typeof next === 'string' && itemRefs.current.has(next);

  // Measuring is layout work, so the thumb is positioned straight on the DOM instead of through
  // state: no extra render, and it is in place before paint.
  React.useLayoutEffect(() => {
    const thumb = thumbRef.current;
    const item = itemRefs.current.get(value);
    if (!thumb) return;
    if (!item) {
      thumb.hidden = true;
      return;
    }
    const measure = () => {
      thumb.style.width = `${item.offsetWidth}px`;
      thumb.style.transform = `translateX(${item.offsetLeft}px)`;
    };
    measure();
    let frame: number | undefined;
    if (thumb.hidden) {
      // The first placement snaps; transitions switch on after it has painted.
      thumb.hidden = false;
      frame = requestAnimationFrame(() => thumb.setAttribute('data-ready', ''));
    }
    // Labels reflow when fonts load or the text changes; a sibling's resize moves this item too.
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    itemRefs.current.forEach(element => observer?.observe(element));
    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [value, children]);

  return (
    <SegmentedControlContext.Provider value={context}>
      <RadioGroupPrimitive
        {...props}
        value={value}
        onValueChange={next => {
          if (isItemValue(next)) onValueChange(next);
        }}
        aria-label={ariaLabel}
        data-slot="segmented-control"
        data-size={size}
        className={cn(
          raisedSurfaceStyle,
          'relative inline-flex w-fit shrink-0 items-stretch rounded-full p-0.5',
          // Circular icon items have no padding of their own to keep them apart.
          iconOnly && 'gap-0.5',
          controlHeight[size],
          'data-[disabled]:opacity-50',
          className,
        )}
      >
        <span
          ref={thumbRef}
          hidden
          aria-hidden="true"
          data-slot="segmented-control-thumb"
          className={cn(
            'pointer-events-none absolute inset-y-0.5 left-0 rounded-full bg-fill-hover ring-1 ring-border ring-inset',
            'motion-safe:data-[ready]:transition-[transform,width] motion-safe:data-[ready]:duration-normal motion-safe:data-[ready]:ease-out-custom',
          )}
        />
        {children}
      </RadioGroupPrimitive>
    </SegmentedControlContext.Provider>
  );
}

export type SegmentedControlItemProps = Omit<RadioPrimitive.Root.Props, 'className' | 'value' | 'children'> & {
  value: string;
  /** Text, an icon and text, or only an icon when the control is `iconOnly`. */
  children: React.ReactNode;
  className?: string;
};

export function SegmentedControlItem({
  value,
  disabled,
  className,
  children,
  ref,
  ...props
}: SegmentedControlItemProps) {
  const context = React.useContext(SegmentedControlContext);
  if (!context) throw new Error('SegmentedControlItem must be used inside a SegmentedControl');
  const { iconOnly, registerItem, unregisterItem } = context;
  const itemRef = mergeRefs<HTMLElement>(ref, element => {
    if (element) registerItem(value, element);
    return () => unregisterItem(value);
  });

  return (
    <RadioPrimitive.Root
      {...props}
      ref={itemRef}
      value={value}
      disabled={disabled}
      data-slot="segmented-control-item"
      className={cn(
        'relative inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-full text-label whitespace-nowrap select-none',
        iconOnly ? 'aspect-square' : 'px-3',
        // A whole disabled group is dimmed on the track; a single disabled item dims itself.
        disabled && 'opacity-50',
        '[&_svg]:size-3.5 [&_svg]:shrink-0',
        'text-muted-foreground hover:text-foreground data-[checked]:text-foreground',
        'focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-border-focus',
        'data-[disabled]:cursor-not-allowed data-[disabled]:hover:text-muted-foreground',
        controlStateColorTransition,
        className,
      )}
    >
      {children}
    </RadioPrimitive.Root>
  );
}
