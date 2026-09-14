import { Select as SelectPrimitive } from '@base-ui/react/select';
import type { SelectPopupProps, SelectPositionerProps } from '@base-ui/react/select';
import { Check, ChevronDown } from 'lucide-react';
import * as React from 'react';

import { buttonVariants } from '../Button/Button';
import type { TextButtonSize } from '../Button/Button';
import { controlTriggerOpenState } from '@/ds/primitives/control-size';
import { FLOATING_POSITION_METHOD } from '@/ds/primitives/floating';
import '@/ds/primitives/focus.css';
import { menuItemCheckClass, menuItemClass, menuPopupClass, menuPositionerClass } from '@/ds/primitives/menu-item';
import { usePortalContainer } from '@/ds/primitives/portal-container';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

type SelectItemNode = React.ReactElement<{ value: unknown; children?: React.ReactNode }>;

function isSelectItem(node: React.ReactNode): node is SelectItemNode {
  return React.isValidElement(node) && (node.type as { displayName?: string })?.displayName === 'SelectItem';
}

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

const SelectValue = React.forwardRef<HTMLSpanElement, SelectValueProps>(({ className, ...props }, ref) => (
  <SelectPrimitive.Value ref={ref} className={cn('truncate', className)} {...props} />
));
SelectValue.displayName = 'SelectValue';

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
        className={cn(
          buttonVariants({ variant: visualVariant, size }),
          'w-full justify-between',
          controlTriggerOpenState[visualVariant],
          'data-[placeholder]:text-neutral3',
          '[&>span]:truncate',
          className,
        )}
        {...props}
      >
        {children}

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
    position?: 'popper' | 'item-aligned';
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
      positionMethod = FLOATING_POSITION_METHOD,
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
        <SelectPrimitive.Positioner className={menuPositionerClass} {...positionerProps}>
          <SelectPrimitive.Popup ref={ref} className={cn(menuPopupClass, className)} {...props}>
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
  <SelectPrimitive.Item ref={ref} className={cn(menuItemClass, className)} {...props}>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <SelectPrimitive.ItemIndicator className={menuItemCheckClass}>
      <Check />
    </SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>
));
SelectItem.displayName = 'SelectItem';

export { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectItem };
