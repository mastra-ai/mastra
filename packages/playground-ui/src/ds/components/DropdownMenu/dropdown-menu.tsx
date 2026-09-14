import { Menu as MenuPrimitive } from '@base-ui/react/menu';
import type { MenuPopupProps, MenuPositionerProps } from '@base-ui/react/menu';
import { CheckIcon, ChevronDown } from 'lucide-react';
import * as React from 'react';
import { FLOATING_POSITION_METHOD } from '@/ds/primitives/floating';
import {
  MENU_SIDE_OFFSET,
  menuItemCheckClass,
  menuItemClass,
  menuItemDestructiveClass,
  menuItemInsetClass,
  menuItemTrailingIconClass,
  menuLabelClass,
  menuPopupClass,
  menuPositionerClass,
  menuSeparatorClass,
  menuShortcutClass,
} from '@/ds/primitives/menu-item';
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
};

const DropdownMenuSubTrigger = React.forwardRef<HTMLDivElement, DropdownMenuSubTriggerProps>(
  ({ className, inset, children, ...props }, ref) => (
    <MenuPrimitive.SubmenuTrigger
      ref={ref}
      className={cn(
        menuItemClass,
        'data-[popup-open]:bg-neutral6/5 data-[popup-open]:text-neutral6',
        inset && menuItemInsetClass,
        className,
      )}
      {...props}
    >
      {children}
      <span className={cn(menuItemTrailingIconClass, 'opacity-50')}>
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
      ...props
    },
    ref,
  ) => {
    // Default to the nearest SideDialog/Drawer popup so the submenu stays
    // interactive inside a modal drawer.
    const resolvedContainer = usePortalContainer();
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
            className={cn(menuPopupClass, className)}
            {...props}
          />
        </MenuPrimitive.Positioner>
      </MenuPrimitive.Portal>
    );
  },
);
DropdownMenuSubContent.displayName = 'DropdownMenuSubContent';

type DropdownMenuContentProps = MenuPopupProps &
  DropdownMenuContentPositionerProps & {
    container?: HTMLElement;
  };

const DropdownMenuContent = React.forwardRef<HTMLDivElement, DropdownMenuContentProps>(
  (
    {
      className,
      container,
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
      ...props
    },
    ref,
  ) => {
    // Default to the nearest SideDialog/Drawer popup so the menu stays
    // interactive inside a modal drawer; an explicit `container` still wins.
    const resolvedContainer = usePortalContainer(container);
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
            className={cn(menuPopupClass, className)}
            {...props}
          />
        </MenuPrimitive.Positioner>
      </MenuPrimitive.Portal>
    );
  },
);
DropdownMenuContent.displayName = 'DropdownMenuContent';

type DropdownMenuItemProps = MenuPrimitive.Item.Props & {
  inset?: boolean;
  variant?: 'default' | 'destructive';
  /** Alias for `onClick`, kept for compatibility with the previous Radix API. */
  onSelect?: MenuPrimitive.Item.Props['onClick'];
};

const DropdownMenuItem = React.forwardRef<HTMLDivElement, DropdownMenuItemProps>(
  ({ className, inset, variant = 'default', onSelect, onClick, ...props }, ref) => (
    <MenuPrimitive.Item
      ref={ref}
      data-inset={inset ? '' : undefined}
      data-variant={variant}
      onClick={event => {
        onClick?.(event);
        onSelect?.(event);
      }}
      className={cn(
        variant === 'destructive' ? menuItemDestructiveClass : menuItemClass,
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
    <MenuPrimitive.CheckboxItem ref={ref} className={cn(menuItemClass, className)} checked={checked} {...props}>
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
    <MenuPrimitive.RadioItem ref={ref} className={cn(menuItemClass, className)} {...props}>
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
    <div ref={ref} className={cn(menuLabelClass, inset && menuItemInsetClass, className)} {...props} />
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

/**
 *
 * Right now, these are the props mostly used for the menu
 * if we find out, consumers need more props, we can just extend it
 * with componentProps
 */
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

export { DropdownMenu };
