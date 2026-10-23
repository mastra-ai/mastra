import { Menu as MenuPrimitive } from '@base-ui/react/menu';
import type { MenuPopupProps, MenuPositionerProps } from '@base-ui/react/menu';
import { CheckIcon, ChevronDown } from 'lucide-react';
import * as React from 'react';
import { FLOATING_POSITION_METHOD } from '@/ds/primitives/floating';
import { useFluidMenu, useFluidMenuItemRef } from '@/ds/primitives/fluid-menu';
import {
  MENU_SIDE_OFFSET,
  menuItemCheckClass,
  menuItemClass,
  menuItemDestructiveClass,
  menuItemHintClass,
  menuItemInsetClass,
  menuItemTrailingIconClass,
  menuLabelClass,
  menuLabelInsetClass,
  menuPopupClass,
  menuPositionerClass,
  menuSeparatorClass,
  menuShortcutClass,
} from '@/ds/primitives/menu-item';
import { menuScrollPopupClass, MenuScrollArea } from '@/ds/primitives/menu-scroll-area';
import { usePortalContainer } from '@/ds/primitives/portal-container';
import { resolveTriggerRender } from '@/ds/primitives/trigger-button';
import type { TriggerButtonProps } from '@/ds/primitives/trigger-button';
import { cn } from '@/lib/utils';

const DropdownMenuRoot = MenuPrimitive.Root;

const DropdownMenuGroup = MenuPrimitive.Group;

const DropdownMenuPortal = MenuPrimitive.Portal;

const DropdownMenuSub = MenuPrimitive.SubmenuRoot;

const DropdownMenuRadioGroup = MenuPrimitive.RadioGroup;

export type DropdownMenuTriggerProps = Omit<MenuPrimitive.Trigger.Props, 'className'> & TriggerButtonProps;

/**
 * The button that opens the menu. Renders a design-system `<Button>` by
 * default, so it takes Button's `variant` / `size` / `tooltip`. Pass `render`
 * to project the behavior onto your own element (then the look is yours).
 */
const DropdownMenuTrigger = React.forwardRef<HTMLButtonElement, DropdownMenuTriggerProps>(
  ({ className, asChild, render, children, variant, size, tooltip, ...props }, ref) => {
    const resolved = resolveTriggerRender({ render, asChild, children, variant, size, tooltip, className });

    return (
      <MenuPrimitive.Trigger ref={ref} className={resolved.className} render={resolved.render} {...props}>
        {resolved.children}
      </MenuPrimitive.Trigger>
    );
  },
);
DropdownMenuTrigger.displayName = 'DropdownMenuTrigger';

type DropdownMenuSubTriggerProps = MenuPrimitive.SubmenuTrigger.Props & {
  inset?: boolean;
  hint?: React.ReactNode;
};

const DropdownMenuSubTrigger = React.forwardRef<HTMLDivElement, DropdownMenuSubTriggerProps>(
  ({ className, inset, hint, children, ...props }, ref) => (
    <MenuPrimitive.SubmenuTrigger
      ref={useFluidMenuItemRef(ref)}
      className={cn(menuItemClass, inset && menuItemInsetClass, className)}
      {...props}
    >
      {children}
      {hint != null && (
        <span data-slot="dropdown-menu-sub-trigger-hint" className={menuItemHintClass}>
          {hint}
        </span>
      )}
      <span className={cn(menuItemTrailingIconClass, hint != null && 'ml-0')}>
        <ChevronDown className="-rotate-90" />
      </span>
    </MenuPrimitive.SubmenuTrigger>
  ),
);
DropdownMenuSubTrigger.displayName = 'DropdownMenuSubTrigger';

type DropdownMenuContentPositionerProps = Omit<MenuPositionerProps, keyof MenuPopupProps>;

type DropdownMenuSubContentProps = MenuPopupProps & DropdownMenuContentPositionerProps;

const DropdownMenuSubContent = React.forwardRef<HTMLDivElement, DropdownMenuSubContentProps>(
  (
    {
      className,
      align = 'start',
      alignOffset = -4,
      side = 'right',
      sideOffset = MENU_SIDE_OFFSET,
      anchor,
      positionMethod = FLOATING_POSITION_METHOD,
      collisionBoundary,
      collisionPadding,
      sticky,
      arrowPadding,
      disableAnchorTracking,
      collisionAvoidance,
      children,
      ...props
    },
    ref,
  ) => {
    // Default to the nearest SideDialog/Drawer popup so the submenu stays
    // interactive inside a modal drawer.
    const resolvedContainer = usePortalContainer();
    const menu = useFluidMenu();
    const positionerProps: DropdownMenuContentPositionerProps = {
      align,
      alignOffset,
      side,
      sideOffset,
      anchor,
      positionMethod,
      collisionBoundary,
      collisionPadding,
      sticky,
      arrowPadding,
      disableAnchorTracking,
      collisionAvoidance,
    };

    return (
      <MenuPrimitive.Portal container={resolvedContainer}>
        <MenuPrimitive.Positioner className={menuPositionerClass} {...positionerProps}>
          <MenuPrimitive.Popup
            ref={ref}
            data-slot="dropdown-menu-sub-content"
            className={cn(menuPopupClass, menuScrollPopupClass, className)}
            {...props}
          >
            <MenuScrollArea menu={menu}>{children}</MenuScrollArea>
          </MenuPrimitive.Popup>
        </MenuPrimitive.Positioner>
      </MenuPrimitive.Portal>
    );
  },
);
DropdownMenuSubContent.displayName = 'DropdownMenuSubContent';

type DropdownMenuContentProps = MenuPopupProps &
  DropdownMenuContentPositionerProps & {
    container?: HTMLElement;
    size?: 'default' | 'sm';
  };

const DropdownMenuContent = React.forwardRef<HTMLDivElement, DropdownMenuContentProps>(
  (
    {
      className,
      container,
      size = 'default',
      align = 'start',
      alignOffset = 0,
      side = 'bottom',
      sideOffset = MENU_SIDE_OFFSET,
      anchor,
      positionMethod = FLOATING_POSITION_METHOD,
      collisionBoundary,
      collisionPadding,
      sticky,
      arrowPadding,
      disableAnchorTracking,
      collisionAvoidance,
      children,
      ...props
    },
    ref,
  ) => {
    // Default to the nearest SideDialog/Drawer popup so the menu stays
    // interactive inside a modal drawer; an explicit `container` still wins.
    const resolvedContainer = usePortalContainer(container);
    const menu = useFluidMenu();
    const positionerProps: DropdownMenuContentPositionerProps = {
      align,
      alignOffset,
      side,
      sideOffset,
      anchor,
      positionMethod,
      collisionBoundary,
      collisionPadding,
      sticky,
      arrowPadding,
      disableAnchorTracking,
      collisionAvoidance,
    };

    return (
      <MenuPrimitive.Portal container={resolvedContainer}>
        <MenuPrimitive.Positioner className={menuPositionerClass} {...positionerProps}>
          <MenuPrimitive.Popup
            ref={ref}
            data-slot="dropdown-menu-content"
            className={cn(
              menuPopupClass,
              menuScrollPopupClass,
              size === 'sm' && 'rounded-md scrollbar-inset-md',
              className,
            )}
            {...props}
          >
            <MenuScrollArea menu={menu} size={size}>
              {children}
            </MenuScrollArea>
          </MenuPrimitive.Popup>
        </MenuPrimitive.Positioner>
      </MenuPrimitive.Portal>
    );
  },
);
DropdownMenuContent.displayName = 'DropdownMenuContent';

type DropdownMenuItemProps = MenuPrimitive.Item.Props & {
  inset?: boolean;
  variant?: 'default' | 'destructive';
  size?: 'default' | 'sm';
  /** Alias for `onClick`, kept for compatibility with the previous Radix API. */
  onSelect?: MenuPrimitive.Item.Props['onClick'];
};

const DropdownMenuItem = React.forwardRef<HTMLDivElement, DropdownMenuItemProps>(
  ({ className, inset, variant = 'default', size = 'default', onSelect, onClick, ...props }, ref) => (
    <MenuPrimitive.Item
      ref={useFluidMenuItemRef(ref)}
      data-inset={inset ? '' : undefined}
      data-variant={variant}
      onClick={event => {
        onClick?.(event);
        onSelect?.(event);
      }}
      className={cn(
        variant === 'destructive' ? menuItemDestructiveClass : menuItemClass,
        size === 'sm' && 'h-control-sm gap-2 rounded-sm py-1 text-caption leading-none',
        inset && menuItemInsetClass,
        className,
      )}
      {...props}
    />
  ),
);
DropdownMenuItem.displayName = 'DropdownMenuItem';

const DropdownMenuCheckboxItem = React.forwardRef<HTMLDivElement, MenuPrimitive.CheckboxItem.Props>(
  ({ className, children, checked, ...props }, ref) => (
    <MenuPrimitive.CheckboxItem
      ref={useFluidMenuItemRef(ref)}
      className={cn(menuItemClass, className)}
      checked={checked}
      {...props}
    >
      {children}
      <MenuPrimitive.CheckboxItemIndicator className={menuItemCheckClass}>
        <CheckIcon />
      </MenuPrimitive.CheckboxItemIndicator>
    </MenuPrimitive.CheckboxItem>
  ),
);
DropdownMenuCheckboxItem.displayName = 'DropdownMenuCheckboxItem';

const DropdownMenuRadioItem = React.forwardRef<HTMLDivElement, MenuPrimitive.RadioItem.Props>(
  ({ className, children, ...props }, ref) => (
    <MenuPrimitive.RadioItem ref={useFluidMenuItemRef(ref)} className={cn(menuItemClass, className)} {...props}>
      {children}
      <MenuPrimitive.RadioItemIndicator className={menuItemCheckClass}>
        <CheckIcon />
      </MenuPrimitive.RadioItemIndicator>
    </MenuPrimitive.RadioItem>
  ),
);
DropdownMenuRadioItem.displayName = 'DropdownMenuRadioItem';

type DropdownMenuLabelProps = React.HTMLAttributes<HTMLDivElement> & {
  inset?: boolean;
};

const DropdownMenuLabel = React.forwardRef<HTMLDivElement, DropdownMenuLabelProps>(
  ({ className, inset, ...props }, ref) => (
    <div ref={ref} className={cn(menuLabelClass, inset && menuLabelInsetClass, className)} {...props} />
  ),
);
DropdownMenuLabel.displayName = 'DropdownMenuLabel';

const DropdownMenuSeparator = React.forwardRef<HTMLDivElement, MenuPrimitive.Separator.Props>(
  ({ className, ...props }, ref) => (
    <MenuPrimitive.Separator ref={ref} className={cn(menuSeparatorClass, className)} {...props} />
  ),
);
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator';

const DropdownMenuShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
  return <span className={cn(menuShortcutClass, className)} {...props} />;
};
DropdownMenuShortcut.displayName = 'DropdownMenuShortcut';

export type DropdownMenuRadioOption<V extends string> = { value: V; label: string; icon?: React.ReactNode };

type DropdownMenuRadioOptionsProps<V extends string> = {
  options: readonly DropdownMenuRadioOption<V>[];
  value: V;
  onValueChange: (value: V) => void;
};

function DropdownMenuRadioOptions<V extends string>({
  options,
  value,
  onValueChange,
}: DropdownMenuRadioOptionsProps<V>) {
  return (
    <DropdownMenuRadioGroup
      value={value}
      onValueChange={(next: unknown) => {
        const picked = options.find(option => option.value === next);
        if (picked) onValueChange(picked.value);
      }}
    >
      {options.map(option => (
        <DropdownMenuRadioItem key={option.value} value={option.value}>
          {option.icon}
          <span>{option.label}</span>
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );
}

export type DropdownMenuRadioSubProps<V extends string> = DropdownMenuRadioOptionsProps<V> & {
  label: string;
  icon?: React.ReactNode;
};

function DropdownMenuRadioSub<V extends string>({
  label,
  icon,
  options,
  value,
  onValueChange,
}: DropdownMenuRadioSubProps<V>) {
  const selected = options.find(option => option.value === value);
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger hint={selected?.label}>
        {icon}
        <span>{label}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioOptions options={options} value={value} onValueChange={onValueChange} />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

function DropdownMenu({
  open,
  defaultOpen,
  onOpenChange,
  children,
  modal,
}: {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: MenuPrimitive.Root.Props['onOpenChange'];
  children: React.ReactNode;
  modal?: boolean;
}) {
  return (
    <DropdownMenuRoot modal={modal} open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      {children}
    </DropdownMenuRoot>
  );
}

DropdownMenu.Trigger = DropdownMenuTrigger;
DropdownMenu.Content = DropdownMenuContent;
DropdownMenu.Group = DropdownMenuGroup;
DropdownMenu.Portal = DropdownMenuPortal;
DropdownMenu.Item = DropdownMenuItem;
DropdownMenu.CheckboxItem = DropdownMenuCheckboxItem;
DropdownMenu.RadioItem = DropdownMenuRadioItem;
DropdownMenu.Label = DropdownMenuLabel;
DropdownMenu.Separator = DropdownMenuSeparator;
DropdownMenu.Shortcut = DropdownMenuShortcut;
DropdownMenu.Sub = DropdownMenuSub;
DropdownMenu.SubContent = DropdownMenuSubContent;
DropdownMenu.SubTrigger = DropdownMenuSubTrigger;
DropdownMenu.RadioGroup = DropdownMenuRadioGroup;
DropdownMenu.RadioOptions = DropdownMenuRadioOptions;
DropdownMenu.RadioSub = DropdownMenuRadioSub;

export { DropdownMenu };
