import { ContextMenu as ContextMenuPrimitive } from '@base-ui/react/context-menu';
import type { ContextMenuPopupProps, ContextMenuPositionerProps } from '@base-ui/react/context-menu';
import { CheckIcon, ChevronDown } from 'lucide-react';
import * as React from 'react';
import { FLOATING_POSITION_METHOD } from '@/ds/primitives/floating';
import { FluidMenuItems, useFluidMenu, useFluidMenuItemRef } from '@/ds/primitives/fluid-menu';
import {
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
import { cn } from '@/lib/utils';

const ContextMenuRoot = ContextMenuPrimitive.Root;
const ContextMenuGroup = ContextMenuPrimitive.Group;
const ContextMenuPortal = ContextMenuPrimitive.Portal;
const ContextMenuSub = ContextMenuPrimitive.SubmenuRoot;
const ContextMenuRadioGroup = ContextMenuPrimitive.RadioGroup;

const ContextMenuTrigger = ContextMenuPrimitive.Trigger;

type ContextMenuContentPositionerProps = Omit<ContextMenuPositionerProps, keyof ContextMenuPopupProps>;

type ContextMenuContentProps = ContextMenuPopupProps &
  ContextMenuContentPositionerProps & {
    container?: HTMLElement;
  };

const ContextMenuContent = React.forwardRef<HTMLDivElement, ContextMenuContentProps>(
  (
    {
      className,
      align = 'start',
      alignOffset = 4,
      side,
      sideOffset = 0,
      container,
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
    const positionerProps: ContextMenuContentPositionerProps = {
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

    // Why: same stacking as DropdownMenu (z-50). Inside a modal Dialog/Drawer the popup must
    // portal into the trap container to stay clickable and above it; explicit `container` wins.
    const resolvedContainer = usePortalContainer(container);
    const menu = useFluidMenu<HTMLDivElement>();

    return (
      <ContextMenuPrimitive.Portal container={resolvedContainer}>
        <ContextMenuPrimitive.Positioner className={menuPositionerClass} {...positionerProps}>
          <ContextMenuPrimitive.Popup
            data-slot="context-menu-content"
            className={cn(menuPopupClass, menu.containerClassName, className)}
            {...props}
            {...menu.getContainerProps(props, ref)}
          >
            <FluidMenuItems menu={menu}>{children}</FluidMenuItems>
          </ContextMenuPrimitive.Popup>
        </ContextMenuPrimitive.Positioner>
      </ContextMenuPrimitive.Portal>
    );
  },
);
ContextMenuContent.displayName = 'ContextMenuContent';

type ContextMenuItemProps = ContextMenuPrimitive.Item.Props & {
  inset?: boolean;
  variant?: 'default' | 'destructive';
  /** Alias for `onClick`, kept for parity with `DropdownMenu.Item`. */
  onSelect?: ContextMenuPrimitive.Item.Props['onClick'];
};

const ContextMenuItem = React.forwardRef<HTMLDivElement, ContextMenuItemProps>(
  ({ className, inset, variant = 'default', onSelect, onClick, ...props }, ref) => (
    <ContextMenuPrimitive.Item
      ref={useFluidMenuItemRef(ref)}
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
ContextMenuItem.displayName = 'ContextMenuItem';

const ContextMenuCheckboxItem = React.forwardRef<HTMLDivElement, ContextMenuPrimitive.CheckboxItem.Props>(
  ({ className, children, checked, ...props }, ref) => (
    <ContextMenuPrimitive.CheckboxItem
      ref={useFluidMenuItemRef(ref)}
      checked={checked}
      className={cn(menuItemClass, className)}
      {...props}
    >
      {children}
      <ContextMenuPrimitive.CheckboxItemIndicator className={menuItemCheckClass}>
        <CheckIcon />
      </ContextMenuPrimitive.CheckboxItemIndicator>
    </ContextMenuPrimitive.CheckboxItem>
  ),
);
ContextMenuCheckboxItem.displayName = 'ContextMenuCheckboxItem';

const ContextMenuRadioItem = React.forwardRef<HTMLDivElement, ContextMenuPrimitive.RadioItem.Props>(
  ({ className, children, ...props }, ref) => (
    <ContextMenuPrimitive.RadioItem ref={useFluidMenuItemRef(ref)} className={cn(menuItemClass, className)} {...props}>
      {children}
      <ContextMenuPrimitive.RadioItemIndicator className={menuItemCheckClass}>
        <CheckIcon />
      </ContextMenuPrimitive.RadioItemIndicator>
    </ContextMenuPrimitive.RadioItem>
  ),
);
ContextMenuRadioItem.displayName = 'ContextMenuRadioItem';

type ContextMenuLabelProps = React.HTMLAttributes<HTMLDivElement> & { inset?: boolean };

const ContextMenuLabel = React.forwardRef<HTMLDivElement, ContextMenuLabelProps>(
  ({ className, inset, ...props }, ref) => (
    <div ref={ref} className={cn(menuLabelClass, inset && menuItemInsetClass, className)} {...props} />
  ),
);
ContextMenuLabel.displayName = 'ContextMenuLabel';

const ContextMenuSeparator = React.forwardRef<HTMLDivElement, ContextMenuPrimitive.Separator.Props>(
  ({ className, ...props }, ref) => (
    <ContextMenuPrimitive.Separator ref={ref} className={cn(menuSeparatorClass, className)} {...props} />
  ),
);
ContextMenuSeparator.displayName = 'ContextMenuSeparator';

const ContextMenuShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
  return <span className={cn(menuShortcutClass, className)} {...props} />;
};
ContextMenuShortcut.displayName = 'ContextMenuShortcut';

type ContextMenuSubTriggerProps = ContextMenuPrimitive.SubmenuTrigger.Props & { inset?: boolean };

const ContextMenuSubTrigger = React.forwardRef<HTMLDivElement, ContextMenuSubTriggerProps>(
  ({ className, inset, children, ...props }, ref) => (
    <ContextMenuPrimitive.SubmenuTrigger
      ref={useFluidMenuItemRef(ref)}
      className={cn(
        menuItemClass,
        'data-[popup-open]:bg-neutral6/5 data-[popup-open]:text-foreground',
        inset && menuItemInsetClass,
        className,
      )}
      {...props}
    >
      {children}
      <span className={cn(menuItemTrailingIconClass, 'opacity-50')}>
        <ChevronDown className="-rotate-90" />
      </span>
    </ContextMenuPrimitive.SubmenuTrigger>
  ),
);
ContextMenuSubTrigger.displayName = 'ContextMenuSubTrigger';

type ContextMenuSubContentProps = ContextMenuPopupProps & ContextMenuContentPositionerProps;

const ContextMenuSubContent = React.forwardRef<HTMLDivElement, ContextMenuSubContentProps>(
  (
    {
      className,
      align = 'start',
      alignOffset = -4,
      side = 'right',
      sideOffset = -4,
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
    const positionerProps: ContextMenuContentPositionerProps = {
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

    const resolvedContainer = usePortalContainer();
    const menu = useFluidMenu<HTMLDivElement>();

    return (
      <ContextMenuPrimitive.Portal container={resolvedContainer}>
        <ContextMenuPrimitive.Positioner className={menuPositionerClass} {...positionerProps}>
          <ContextMenuPrimitive.Popup
            data-slot="context-menu-sub-content"
            className={cn(menuPopupClass, menu.containerClassName, className)}
            {...props}
            {...menu.getContainerProps(props, ref)}
          >
            <FluidMenuItems menu={menu}>{children}</FluidMenuItems>
          </ContextMenuPrimitive.Popup>
        </ContextMenuPrimitive.Positioner>
      </ContextMenuPrimitive.Portal>
    );
  },
);
ContextMenuSubContent.displayName = 'ContextMenuSubContent';

function ContextMenu({
  open,
  defaultOpen,
  onOpenChange,
  children,
}: {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: ContextMenuPrimitive.Root.Props['onOpenChange'];
  children: React.ReactNode;
}) {
  return (
    <ContextMenuRoot open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      {children}
    </ContextMenuRoot>
  );
}

ContextMenu.Trigger = ContextMenuTrigger;
ContextMenu.Content = ContextMenuContent;
ContextMenu.Group = ContextMenuGroup;
ContextMenu.Portal = ContextMenuPortal;
ContextMenu.Item = ContextMenuItem;
ContextMenu.CheckboxItem = ContextMenuCheckboxItem;
ContextMenu.RadioItem = ContextMenuRadioItem;
ContextMenu.Label = ContextMenuLabel;
ContextMenu.Separator = ContextMenuSeparator;
ContextMenu.Shortcut = ContextMenuShortcut;
ContextMenu.Sub = ContextMenuSub;
ContextMenu.SubContent = ContextMenuSubContent;
ContextMenu.SubTrigger = ContextMenuSubTrigger;
ContextMenu.RadioGroup = ContextMenuRadioGroup;

export { ContextMenu };
