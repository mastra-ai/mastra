import { Select as SelectPrimitive } from '@base-ui/react/select';
import type { SelectPopupProps, SelectPositionerProps } from '@base-ui/react/select';
import { Check, ChevronDown } from 'lucide-react';
import * as React from 'react';

import { buttonVariants } from '../Button/Button';
import type { TextButtonSize } from '../Button/Button';
import { controlTriggerOpenState } from '@/ds/primitives/control-size';
import { usePortalContainer } from '@/ds/primitives/portal-container';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

/**
 * Select migrated from `@radix-ui/react-select` to Base UI (`@base-ui/react/select`).
 *
 * The public API (`Select`, `SelectGroup`, `SelectValue`, `SelectTrigger`,
 * `SelectContent`, `SelectItem`) is intentionally kept stable so existing
 * consumers do not need changes.
 *
 * Notable behavioral differences vs. Radix that consumers should be aware of:
 * - `onValueChange` now receives a second `eventDetails` argument. Existing
 *   handlers typed as `(value: string) => void` keep working (extra arg ignored).
 * - The dropdown no longer overlaps the trigger by default
 *   (`alignItemWithTrigger={false}`), matching the previous Radix `popper`
 *   positioning behavior.
 *
 * Implementation note: unlike Radix, Base UI's `Select.Value` can only resolve
 * a selected value to its label once the popup has mounted (it reads labels
 * from rendered items). To preserve the Radix behavior where the trigger shows
 * the selected label even while closed, `Select` auto-derives an `items` map
 * from the `SelectItem`s declared inside `SelectContent` and passes it to
 * `Select.Root`. Consumers can still pass an explicit `items` prop to override.
 */
type SelectItemNode = React.ReactElement<{ value: unknown; children?: React.ReactNode }>;

function isSelectItem(node: React.ReactNode): node is SelectItemNode {
  return React.isValidElement(node) && (node.type as { displayName?: string })?.displayName === 'SelectItem';
}

/** Recursively collect `{ value, label }` pairs from declared `SelectItem`s. */
function collectItems(children: React.ReactNode, acc: Array<{ value: unknown; label: React.ReactNode }>): void {
  React.Children.forEach(children, child => {
    if (!React.isValidElement(child)) return;
    if (isSelectItem(child)) {
      acc.push({ value: child.props.value, label: child.props.children });
      return;
    }
    const nested = (child.props as { children?: React.ReactNode })?.children;
    if (nested != null) collectItems(nested, acc);
  });
}

type SelectRootProps<Value> = SelectPrimitive.Root.Props<Value, false>;
type SelectChangeDetails = Parameters<NonNullable<SelectRootProps<unknown>['onValueChange']>>[1];

/**
 * `onValueChange` is intentionally narrowed to a non-null value: these selects
 * always hold a value once changed, which keeps existing `(value) => void`
 * consumer handlers valid (Base UI's own callback type is `Value | null`).
 */
type SelectProps<Value = string> = Omit<SelectRootProps<Value>, 'onValueChange'> & {
  onValueChange?: (value: Value, eventDetails: SelectChangeDetails) => void;
};

function Select<Value = string>({ children, items, onValueChange, ...props }: SelectProps<Value>) {
  const derivedItems = React.useMemo(() => {
    if (items != null) return items;
    const acc: Array<{ value: unknown; label: React.ReactNode }> = [];
    collectItems(children, acc);
    return acc.length > 0 ? acc : undefined;
  }, [items, children]);

  return (
    <SelectPrimitive.Root
      items={derivedItems as SelectRootProps<Value>['items']}
      onValueChange={onValueChange ? (value, eventDetails) => onValueChange(value as Value, eventDetails) : undefined}
      {...props}
    >
      {children}
    </SelectPrimitive.Root>
  );
}
Select.displayName = 'Select';

const SelectGroup = SelectPrimitive.Group;

export type SelectValueProps = Omit<SelectPrimitive.Value.Props, 'className'> & {
  className?: string;
};

/**
 * Displays the selected value. Radix's `Select.Value` took a `placeholder`
 * prop and rendered the selected item's text automatically; Base UI's
 * `Select.Value` behaves the same way (renders the value, falls back to
 * `placeholder` when nothing is selected), so this is a thin passthrough.
 */
const SelectValue = React.forwardRef<HTMLSpanElement, SelectValueProps>(({ className, ...props }, ref) => (
  <SelectPrimitive.Value ref={ref} className={cn('truncate', className)} {...props} />
));
SelectValue.displayName = 'SelectValue';

/**
 * A select is a form field, so it reuses the same button looks consumers see
 * everywhere: `default` (the Button's filled default surface — the default
 * here too), `outline` (bordered, transparent) and `ghost` (borderless, for
 * dense toolbars/inline pickers). The high-emphasis `primary` look is the only
 * one intentionally NOT offered (a field is not a call-to-action).
 */
export type SelectTriggerVariant = 'default' | 'outline' | 'ghost';
type SelectTriggerLegacyVariant = 'primary';

export type SelectTriggerProps = Omit<SelectPrimitive.Trigger.Props, 'className'> & {
  className?: string;
  size?: TextButtonSize;
  variant?: SelectTriggerVariant | SelectTriggerLegacyVariant;
};

function normalizeSelectTriggerVariant(
  variant: SelectTriggerVariant | SelectTriggerLegacyVariant,
): SelectTriggerVariant {
  return variant === 'primary' ? 'default' : variant;
}

const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ className, children, size = 'md', variant = 'default', ...props }, ref) => {
    const visualVariant = normalizeSelectTriggerVariant(variant);

    return (
      <SelectPrimitive.Trigger
        ref={ref}
        data-slot="select-trigger"
        // A select = a button + a trailing chevron: reuse the Button recipe
        // (variant colors, size = height/text/padding/radius, unified border
        // focus, disabled) and layer only the select-specific extras.
        className={cn(
          buttonVariants({ variant: visualVariant, size }),
          // Fill the field and push the value left / chevron right (Button's
          // base centers its content with `justify-center`).
          'w-full justify-between',
          // Read as "active" while the menu is open, per variant (see map above).
          controlTriggerOpenState[visualVariant],
          'data-[placeholder]:text-neutral3',
          '[&>span]:truncate',
          className,
        )}
        {...props}
      >
        {children}
        {/* `SelectPrimitive.Icon` renders the provided element in place of its
            default `<span>`, so the chevron would land as a *direct* `<svg>`
            child of the trigger — where Button's `TEXT_MODE_ADORNMENTS`
            `[&>svg]` rules (negative `mx`, forced 50% opacity, 1.1em sizing)
            would distort and mis-position it. Wrapping it in a `<span>` keeps
            the svg one level deep so those rules can't reach it, leaving the
            chevron pinned at the right edge at its intended size and opacity. */}
        <SelectPrimitive.Icon
          render={
            <span className="flex shrink-0 items-center">
              <ChevronDown className={cn('size-4 opacity-60', transitions.colors)} />
            </span>
          }
        />
      </SelectPrimitive.Trigger>
    );
  },
);
SelectTrigger.displayName = 'SelectTrigger';

type SelectContentPositionerProps = Omit<SelectPositionerProps, keyof SelectPopupProps>;

export type SelectContentProps = Omit<SelectPopupProps, 'className'> &
  SelectContentPositionerProps & {
    className?: string;
    /**
     * Kept for API compatibility with the previous Radix API. Radix supported
     * `position="popper" | "item-aligned"`; Base UI always uses popper-style
     * positioning so this prop is accepted but has no effect.
     */
    position?: 'popper' | 'item-aligned';
    /** Optional portal container, forwarded to `Select.Portal`. */
    container?: HTMLElement | null;
  };

const SelectContent = React.forwardRef<HTMLDivElement, SelectContentProps>(
  (
    {
      className,
      children,
      position: _position,
      container,
      side = 'bottom',
      align = 'start',
      sideOffset = 4,
      alignItemWithTrigger = false,
      anchor,
      positionMethod,
      alignOffset,
      collisionBoundary,
      collisionPadding,
      sticky,
      arrowPadding,
      disableAnchorTracking,
      collisionAvoidance,
      ...props
    },
    ref,
  ) => {
    // Default to the nearest SideDialog/Drawer popup so the dropdown stays
    // interactive inside a modal drawer; an explicit `container` still wins.
    const resolvedContainer = usePortalContainer(container);
    const positionerProps: SelectContentPositionerProps = {
      side,
      align,
      sideOffset,
      alignItemWithTrigger,
      anchor,
      positionMethod,
      alignOffset,
      collisionBoundary,
      collisionPadding,
      sticky,
      arrowPadding,
      disableAnchorTracking,
      collisionAvoidance,
    };

    return (
      <SelectPrimitive.Portal container={resolvedContainer}>
        <SelectPrimitive.Positioner className="z-50 outline-none" {...positionerProps}>
          <SelectPrimitive.Popup
            ref={ref}
            className={cn(
              'relative z-50 max-h-[min(var(--max-height-dropdown-max-height),var(--available-height))] min-w-[max(8rem,var(--anchor-width))] origin-[var(--transform-origin)] overflow-x-hidden overflow-y-auto rounded-xl border border-border1 bg-surface3 p-1 text-neutral4 shadow-dialog',
              'data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95 data-[open]:animate-in data-[open]:fade-in-0 data-[open]:zoom-in-95',
              'data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1',
              className,
            )}
            {...props}
          >
            <SelectPrimitive.List>{children}</SelectPrimitive.List>
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    );
  },
);
SelectContent.displayName = 'SelectContent';

export type SelectItemProps = Omit<SelectPrimitive.Item.Props, 'className'> & {
  className?: string;
};

const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-pointer items-center gap-2.5 rounded-lg py-1.5 pr-8 pl-2 text-ui-smd leading-ui-sm text-neutral4 select-none',
      'outline-none focus:outline-none focus-visible:outline-none',
      transitions.colors,
      'hover:bg-surface4 hover:text-neutral6',
      'focus:bg-surface4 focus:text-neutral6',
      'data-[highlighted]:bg-surface4 data-[highlighted]:text-neutral6',
      'data-[selected]:text-neutral6',
      'data-disabled:pointer-events-none data-disabled:opacity-50',
      className,
    )}
    {...props}
  >
    <span className="absolute right-2 flex size-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="text-neutral6 size-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = 'SelectItem';

export { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectItem };
