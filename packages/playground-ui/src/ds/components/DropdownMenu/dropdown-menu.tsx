import { Menu as MenuPrimitive } from '@base-ui/react/menu';
import type { MenuPopupProps, MenuPositionerProps } from '@base-ui/react/menu';
import { CheckIcon, ChevronDown, Circle } from 'lucide-react';
import * as React from 'react';
import { usePortalContainer } from '@/ds/primitives/portal-container';
import { asChildRenderProps } from '@/lib/as-child';
import { cn } from '@/lib/utils';

const DropdownMenuRoot = MenuPrimitive.Root;

const DropdownMenuGroup = MenuPrimitive.Group;

const DropdownMenuPortal = MenuPrimitive.Portal;

const DropdownMenuSub = MenuPrimitive.SubmenuRoot;

const DropdownMenuRadioGroup = MenuPrimitive.RadioGroup;

const itemClass = cn(
  'relative flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-ui-smd leading-ui-sm text-neutral4 transition-colors outline-none select-none hover:bg-surface4 hover:text-neutral6 focus:bg-surface4 focus:text-neutral6 focus:outline-none focus-visible:ring-0 focus-visible:outline-none data-disabled:cursor-not-allowed data-disabled:opacity-50 data-disabled:hover:bg-transparent data-disabled:hover:text-neutral4 data-disabled:focus:bg-transparent data-disabled:focus:text-neutral4 data-[highlighted]:bg-surface4 data-[highlighted]:text-neutral6 data-disabled:data-[highlighted]:bg-transparent data-disabled:data-[highlighted]:text-neutral4 [&_svg]:size-4 [&_svg]:shrink-0 [&>span]:truncate',
  '[&:hover>svg]:opacity-100 [&>svg]:size-[1.1em] [&>svg]:opacity-60',
);

const popupClass = cn(
  'z-50 max-h-[min(20rem,var(--available-height))] min-w-44 origin-[var(--transform-origin)] overflow-x-hidden overflow-y-auto rounded-xl border border-border1 bg-surface3 p-1 text-neutral4 shadow-dialog outline-none',
  'data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95 data-[open]:animate-in data-[open]:fade-in-0 data-[open]:zoom-in-95',
  'data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1',
);

type DropdownMenuTriggerProps = MenuPrimitive.Trigger.Props & {
  /** @deprecated Use Base UI's native `render` prop instead for stronger composition typing. */
  asChild?: boolean;
};

const DropdownMenuTrigger = React.forwardRef<HTMLButtonElement, DropdownMenuTriggerProps>(
  ({ className, asChild, children, ...props }, ref) => {
    return (
      <MenuPrimitive.Trigger
        ref={ref}
        className={cn('cursor-pointer outline-none', className)}
        {...asChildRenderProps(asChild, children)}
        {...props}
      >
        {asChild ? undefined : children}
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
        itemClass,
        'data-[popup-open]:bg-surface4 data-[popup-open]:text-neutral6',
        inset && 'pl-8',
        className,
      )}
      {...props}
    >
      {children}
      <span className="ml-auto pl-2">
        <ChevronDown className="-rotate-90 opacity-50" />
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
      sideOffset = 0,
      anchor,
      positionMethod,
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
        <MenuPrimitive.Positioner className="z-50 outline-none" {...positionerProps}>
          <MenuPrimitive.Popup
            ref={ref}
            data-slot="dropdown-menu-sub-content"
            className={cn(popupClass, className)}
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
      sideOffset = 8,
      anchor,
      positionMethod,
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
        <MenuPrimitive.Positioner className="z-50 outline-none" {...positionerProps}>
          <MenuPrimitive.Popup
            ref={ref}
            data-slot="dropdown-menu-content"
            className={cn(popupClass, className)}
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
        itemClass,
        inset && 'pl-8',
        'data-[variant=destructive]:text-accent2 data-[variant=destructive]:hover:bg-accent2/10 data-[variant=destructive]:hover:text-accent2 data-[variant=destructive]:data-[highlighted]:bg-accent2/10 data-[variant=destructive]:data-[highlighted]:text-accent2',
        className,
      )}
      {...props}
    />
  ),
);
DropdownMenuItem.displayName = 'DropdownMenuItem';

const DropdownMenuCheckboxItem = React.forwardRef<HTMLDivElement, MenuPrimitive.CheckboxItem.Props>(
  ({ className, children, checked, ...props }, ref) => (
    <MenuPrimitive.CheckboxItem ref={ref} className={cn(itemClass, 'w-full', className)} checked={checked} {...props}>
      <div className="border-border2 flex size-4 items-center justify-center rounded-sm border">
        <MenuPrimitive.CheckboxItemIndicator>
          <CheckIcon />
        </MenuPrimitive.CheckboxItemIndicator>
      </div>
      {children}
    </MenuPrimitive.CheckboxItem>
  ),
);
DropdownMenuCheckboxItem.displayName = 'DropdownMenuCheckboxItem';

const DropdownMenuRadioItem = React.forwardRef<HTMLDivElement, MenuPrimitive.RadioItem.Props>(
  ({ className, children, ...props }, ref) => (
    <MenuPrimitive.RadioItem
      ref={ref}
      className={cn(
        'relative flex cursor-pointer items-center rounded-lg py-1.5 pr-2 pl-8 text-ui-smd leading-ui-sm text-neutral4 transition-colors outline-none select-none hover:bg-surface4 hover:text-neutral6 focus:bg-surface4 focus:text-neutral6 focus:outline-none focus-visible:ring-0 focus-visible:outline-none data-disabled:cursor-not-allowed data-disabled:opacity-50 data-disabled:hover:bg-transparent data-disabled:hover:text-neutral4 data-disabled:focus:bg-transparent data-disabled:focus:text-neutral4 data-[highlighted]:bg-surface4 data-[highlighted]:text-neutral6 data-disabled:data-[highlighted]:bg-transparent data-disabled:data-[highlighted]:text-neutral4',
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex size-3.5 items-center justify-center">
        <MenuPrimitive.RadioItemIndicator>
          <Circle className="size-2 fill-current" />
        </MenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </MenuPrimitive.RadioItem>
  ),
);
DropdownMenuRadioItem.displayName = 'DropdownMenuRadioItem';

type DropdownMenuLabelProps = React.HTMLAttributes<HTMLDivElement> & {
  inset?: boolean;
};

const DropdownMenuLabel = React.forwardRef<HTMLDivElement, DropdownMenuLabelProps>(
  ({ className, inset, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'px-2 pt-1.5 pb-1 text-ui-xs font-medium tracking-wider text-neutral3 uppercase',
        inset && 'pl-8',
        className,
      )}
      {...props}
    />
  ),
);
DropdownMenuLabel.displayName = 'DropdownMenuLabel';

const DropdownMenuSeparator = React.forwardRef<HTMLDivElement, MenuPrimitive.Separator.Props>(
  ({ className, ...props }, ref) => (
    <MenuPrimitive.Separator ref={ref} className={cn('-mx-1 my-1 h-px bg-border1', className)} {...props} />
  ),
);
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator';

const DropdownMenuShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
  return <span className={cn('ml-auto text-xs tracking-widest opacity-60', className)} {...props} />;
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
