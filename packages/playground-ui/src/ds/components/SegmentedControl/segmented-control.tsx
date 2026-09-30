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
  registerItem: (value: string, element: HTMLElement | null) => void;
};

const SegmentedControlContext = React.createContext<SegmentedControlContextValue | null>(null);

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
  const [thumb, setThumb] = React.useState<{ left: number; width: number } | null>(null);
  // The first placement snaps; only later moves animate.
  const [animate, setAnimate] = React.useState(false);

  const context = React.useMemo<SegmentedControlContextValue>(
    () => ({
      iconOnly,
      registerItem: (itemValue, element) => {
        if (element) itemRefs.current.set(itemValue, element);
        else itemRefs.current.delete(itemValue);
      },
    }),
    [iconOnly],
  );

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
  }, [value, children]);

  React.useEffect(() => {
    if (thumb && !animate) setAnimate(true);
  }, [thumb, animate]);

  return (
    <SegmentedControlContext.Provider value={context}>
      <RadioGroupPrimitive
        {...props}
        value={value}
        // Items carry the values the caller typed as `T`.
        onValueChange={next => onValueChange(next as T)}
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
  const registerItem = context?.registerItem;
  const itemRef = React.useMemo(
    () =>
      mergeRefs<HTMLElement>(ref, element => {
        registerItem?.(value, element);
        return () => registerItem?.(value, null);
      }),
    [ref, registerItem, value],
  );
  if (!context) throw new Error('SegmentedControlItem must be used inside a SegmentedControl');
  const { iconOnly } = context;

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
