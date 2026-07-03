import { ContextMenu as ContextMenuPrimitive } from '@base-ui/react/context-menu';
import type { ContextMenuPopupProps, ContextMenuPositionerProps } from '@base-ui/react/context-menu';
import { CheckIcon, ChevronDown, Circle } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

const ContextMenuRoot = ContextMenuPrimitive.Root;
const ContextMenuGroup = ContextMenuPrimitive.Group;
const ContextMenuPortal = ContextMenuPrimitive.Portal;
const ContextMenuSub = ContextMenuPrimitive.SubmenuRoot;
const ContextMenuRadioGroup = ContextMenuPrimitive.RadioGroup;

const itemClass = cn(
  'relative flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2 py-1.5 text-ui-smd leading-ui-sm transition-colors text-neutral4 hover:text-neutral6 focus:text-neutral6 hover:bg-surface4 focus:bg-surface4 data-[highlighted]:bg-surface4 data-[highlighted]:text-neutral6 data-disabled:cursor-not-allowed data-disabled:opacity-50 data-disabled:hover:bg-transparent data-disabled:hover:text-neutral4 data-disabled:focus:bg-transparent data-disabled:focus:text-neutral4 data-disabled:data-[highlighted]:bg-transparent data-disabled:data-[highlighted]:text-neutral4 [&>span]:truncate [&_svg]:size-4 [&_svg]:shrink-0 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0',
  '[&>svg]:w-[1.1em] [&>svg]:h-[1.1em] [&>svg]:opacity-60 [&:hover>svg]:opacity-100',
);

const popupClass = cn(
  'bg-surface3 text-neutral4 z-1000 min-w-44 max-h-[min(20rem,var(--available-height))] overflow-x-hidden overflow-y-auto rounded-xl border border-border1 p-1 shadow-dialog origin-[var(--transform-origin)] outline-none',
  'data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0 data-[closed]:zoom-out-95 data-[open]:zoom-in-95',
  'data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1',
);

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

    return (
      <ContextMenuPrimitive.Portal container={container}>
        <ContextMenuPrimitive.Positioner className="isolate z-1000 outline-none" {...positionerProps}>
          <ContextMenuPrimitive.Popup
            ref={ref}
            data-slot="context-menu-content"
            className={cn(popupClass, className)}
            {...props}
          />
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
ContextMenuItem.displayName = 'ContextMenuItem';

const ContextMenuCheckboxItem = React.forwardRef<HTMLDivElement, ContextMenuPrimitive.CheckboxItem.Props>(
  ({ className, children, checked, ...props }, ref) => (
    <ContextMenuPrimitive.CheckboxItem
      ref={ref}
      checked={checked}
      className={cn(itemClass, 'w-full', className)}
      {...props}
    >
      <div className="border border-border2 flex h-4 w-4 items-center justify-center rounded-sm">
        <ContextMenuPrimitive.CheckboxItemIndicator>
          <CheckIcon />
        </ContextMenuPrimitive.CheckboxItemIndicator>
      </div>
      {children}
    </ContextMenuPrimitive.CheckboxItem>
  ),
);
ContextMenuCheckboxItem.displayName = 'ContextMenuCheckboxItem';

const ContextMenuRadioItem = React.forwardRef<HTMLDivElement, ContextMenuPrimitive.RadioItem.Props>(
  ({ className, children, ...props }, ref) => (
    <ContextMenuPrimitive.RadioItem
      ref={ref}
      className={cn(
        'relative flex cursor-pointer select-none items-center rounded-lg py-1.5 pl-8 pr-2 text-ui-smd leading-ui-sm transition-colors text-neutral4 hover:text-neutral6 focus:text-neutral6 hover:bg-surface4 focus:bg-surface4 data-[highlighted]:bg-surface4 data-[highlighted]:text-neutral6 data-disabled:cursor-not-allowed data-disabled:opacity-50 data-disabled:hover:bg-transparent data-disabled:hover:text-neutral4 data-disabled:focus:bg-transparent data-disabled:focus:text-neutral4 data-disabled:data-[highlighted]:bg-transparent data-disabled:data-[highlighted]:text-neutral4 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0',
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <ContextMenuPrimitive.RadioItemIndicator>
          <Circle className="h-2 w-2 fill-current" />
        </ContextMenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.RadioItem>
  ),
);
ContextMenuRadioItem.displayName = 'ContextMenuRadioItem';

type ContextMenuLabelProps = React.HTMLAttributes<HTMLDivElement> & { inset?: boolean };

const ContextMenuLabel = React.forwardRef<HTMLDivElement, ContextMenuLabelProps>(
  ({ className, inset, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'px-2 pt-1.5 pb-1 text-ui-xs font-medium uppercase tracking-wider text-neutral3',
        inset && 'pl-8',
        className,
      )}
      {...props}
    />
  ),
);
ContextMenuLabel.displayName = 'ContextMenuLabel';

const ContextMenuSeparator = React.forwardRef<HTMLDivElement, ContextMenuPrimitive.Separator.Props>(
  ({ className, ...props }, ref) => (
    <ContextMenuPrimitive.Separator ref={ref} className={cn('bg-border1 -mx-1 my-1 h-px', className)} {...props} />
  ),
);
ContextMenuSeparator.displayName = 'ContextMenuSeparator';

const ContextMenuShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
  return <span className={cn('ml-auto text-xs tracking-widest opacity-60', className)} {...props} />;
};
ContextMenuShortcut.displayName = 'ContextMenuShortcut';

type ContextMenuSubTriggerProps = ContextMenuPrimitive.SubmenuTrigger.Props & { inset?: boolean };

const ContextMenuSubTrigger = React.forwardRef<HTMLDivElement, ContextMenuSubTriggerProps>(
  ({ className, inset, children, ...props }, ref) => (
    <ContextMenuPrimitive.SubmenuTrigger
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

    return (
      <ContextMenuPrimitive.Portal>
        <ContextMenuPrimitive.Positioner className="isolate z-1000 outline-none" {...positionerProps}>
          <ContextMenuPrimitive.Popup
            ref={ref}
            data-slot="context-menu-sub-content"
            className={cn(popupClass, className)}
            {...props}
          />
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
