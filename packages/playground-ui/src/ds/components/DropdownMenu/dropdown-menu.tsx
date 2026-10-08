import { Menu as MenuPrimitive } from '@base-ui/react/menu';
import type { MenuPopupProps, MenuPositionerProps } from '@base-ui/react/menu';
import { CheckIcon, ChevronDown } from 'lucide-react';
import * as React from 'react';
import { DropdownMenuIdentityTrigger } from './dropdown-menu-identity-trigger';
import { FLOATING_POSITION_METHOD } from '@/ds/primitives/floating';
import { FluidMenuItems, useFluidMenu, useFluidMenuItemRef } from '@/ds/primitives/fluid-menu';
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

const NativeItemHighlightContext = React.createContext(false);

function useItemHighlightClass(variant: 'default' | 'destructive' = 'default') {
  const native = React.useContext(NativeItemHighlightContext);
  if (!native) return undefined;
  if (variant === 'destructive') {
    return 'not-disabled:hover:bg-destructive-subtle not-disabled:active:bg-destructive-subtle data-highlighted:bg-destructive-subtle data-popup-open:bg-destructive-subtle';
  }
  return 'not-disabled:hover:bg-fill-subtle not-disabled:active:bg-fill data-highlighted:bg-fill-subtle data-popup-open:bg-fill-subtle';
}

function dropGeneratedLabelledBy(props: { 'aria-label'?: string }) {
  if (!props['aria-label']) return {};
  return { 'aria-labelledby': undefined };
}

const railNavigationKeys = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', ' ']);

function focusRailFromActions(event: React.KeyboardEvent<HTMLDivElement>) {
  if (event.defaultPrevented || event.key !== 'ArrowLeft') return;
  const rail = event.currentTarget.querySelector('[data-slot=dropdown-menu-rail]');
  if (!rail) return;
  const target =
    rail.querySelector<HTMLButtonElement>('button[aria-current=true]:not(:disabled)') ??
    rail.querySelector<HTMLButtonElement>('button:not(:disabled)');
  target?.focus();
  event.preventDefault();
}

function AccountMenuBody({ rail, children }: { rail?: React.ReactNode; children: React.ReactNode }) {
  return (
    <>
      {rail && (
        <div
          data-slot="dropdown-menu-rail"
          className="flex shrink-0 border-r border-border"
          onKeyDown={event => {
            if (event.key === 'ArrowRight') {
              event.currentTarget.parentElement
                ?.querySelector<HTMLElement>('[role=menuitem]:not([data-disabled])')
                ?.focus();
              event.preventDefault();
            }
            if (railNavigationKeys.has(event.key)) event.stopPropagation();
          }}
        >
          {rail}
        </div>
      )}
      <div data-slot="dropdown-menu-actions" className="min-h-0 min-w-0 flex-1 overflow-y-auto px-1 py-0.75">
        {children}
      </div>
    </>
  );
}

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
      ref={useFluidMenuItemRef(ref)}
      className={cn(
        menuItemClass,
        useItemHighlightClass(),
        'data-[popup-open]:text-foreground',
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
      children,
      ...props
    },
    ref,
  ) => {
    // Default to the nearest SideDialog/Drawer popup so the submenu stays
    // interactive inside a modal drawer.
    const resolvedContainer = usePortalContainer();
    const menu = useFluidMenu<HTMLDivElement>();
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
            data-slot="dropdown-menu-sub-content"
            className={cn(menuPopupClass, menu.containerClassName, className)}
            {...props}
            {...menu.getContainerProps(props, ref)}
          >
            <NativeItemHighlightContext.Provider value={false}>
              <FluidMenuItems menu={menu}>{children}</FluidMenuItems>
            </NativeItemHighlightContext.Provider>
          </MenuPrimitive.Popup>
        </MenuPrimitive.Positioner>
      </MenuPrimitive.Portal>
    );
  },
);
DropdownMenuSubContent.displayName = 'DropdownMenuSubContent';

type DropdownMenuContentLayoutProps = { layout?: 'menu'; rail?: never } | { layout: 'account'; rail?: React.ReactNode };

type DropdownMenuContentProps = MenuPopupProps &
  DropdownMenuContentPositionerProps &
  DropdownMenuContentLayoutProps & {
    container?: HTMLElement;
    size?: 'default' | 'sm';
  };

const accountCollisionAvoidance: DropdownMenuContentPositionerProps['collisionAvoidance'] = {
  side: 'shift',
  align: 'shift',
  fallbackAxisSide: 'none',
};

const DropdownMenuContent = React.forwardRef<HTMLDivElement, DropdownMenuContentProps>(
  (
    {
      className,
      container,
      size = 'default',
      layout = 'menu',
      rail,
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
    const menu = useFluidMenu<HTMLDivElement>();
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

    if (layout === 'account') {
      return (
        <MenuPrimitive.Portal container={resolvedContainer}>
          <MenuPrimitive.Positioner
            className={menuPositionerClass}
            {...positionerProps}
            collisionAvoidance={collisionAvoidance ?? accountCollisionAvoidance}
          >
            <MenuPrimitive.Popup
              data-slot="dropdown-menu-content"
              className={cn(menuPopupClass, 'flex max-h-(--available-height) w-87 overflow-hidden p-0', className)}
              {...props}
              ref={ref}
              role="dialog"
              aria-orientation={undefined}
              {...dropGeneratedLabelledBy(props)}
              onKeyDown={event => {
                props.onKeyDown?.(event);
                focusRailFromActions(event);
              }}
            >
              <NativeItemHighlightContext.Provider value>
                <AccountMenuBody rail={rail}>{children}</AccountMenuBody>
              </NativeItemHighlightContext.Provider>
            </MenuPrimitive.Popup>
          </MenuPrimitive.Positioner>
        </MenuPrimitive.Portal>
      );
    }

    return (
      <MenuPrimitive.Portal container={resolvedContainer}>
        <MenuPrimitive.Positioner className={menuPositionerClass} {...positionerProps}>
          <MenuPrimitive.Popup
            data-slot="dropdown-menu-content"
            className={cn(menuPopupClass, menu.containerClassName, size === 'sm' && 'rounded-md p-0.5', className)}
            {...props}
            role={props.role ?? 'menu'}
            aria-orientation="vertical"
            {...dropGeneratedLabelledBy(props)}
            {...menu.getContainerProps(props, ref)}
          >
            <FluidMenuItems menu={menu} className={size === 'sm' ? 'rounded-sm' : undefined}>
              {children}
            </FluidMenuItems>
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
        useItemHighlightClass(variant),
        size === 'sm' && 'h-control-sm gap-2 rounded-sm py-1 text-caption',
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
      className={cn(menuItemClass, useItemHighlightClass(), className)}
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
    <MenuPrimitive.RadioItem
      ref={useFluidMenuItemRef(ref)}
      className={cn(menuItemClass, useItemHighlightClass(), className)}
      {...props}
    >
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
DropdownMenu.IdentityTrigger = DropdownMenuIdentityTrigger;
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
