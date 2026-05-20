import { Menu as MenuPrimitive } from '@base-ui/react/menu';
import { CheckIcon, ChevronDown, Circle } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

const DropdownMenuRoot = MenuPrimitive.Root;

const DropdownMenuGroup = MenuPrimitive.Group;

const DropdownMenuPortal = MenuPrimitive.Portal;

const DropdownMenuSub = MenuPrimitive.SubmenuRoot;

const DropdownMenuRadioGroup = MenuPrimitive.RadioGroup;

const itemClass = cn(
  'relative flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2 py-1.5 text-ui-smd leading-ui-sm transition-colors text-neutral4 hover:text-neutral6 focus:text-neutral6 hover:bg-surface4 focus:bg-surface4 data-[highlighted]:bg-surface4 data-[highlighted]:text-neutral6 data-disabled:pointer-events-none data-disabled:opacity-50 [&>span]:truncate [&_svg]:size-4 [&_svg]:shrink-0 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0',
  '[&>svg]:w-[1.1em] [&>svg]:h-[1.1em] [&>svg]:opacity-60 [&:hover>svg]:opacity-100',
);

const DropdownMenuTrigger = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.Trigger ref={ref} className={cn('cursor-pointer outline-none', className)} {...props}>
    {children}
  </DropdownMenuPrimitive.Trigger>
));

type DropdownMenuTriggerProps = MenuPrimitive.Trigger.Props & {
  asChild?: boolean;
};

const DropdownMenuTrigger = React.forwardRef<HTMLButtonElement, DropdownMenuTriggerProps>(
  ({ className, asChild, children, ...props }, ref) => {
    const renderProps = asChild && React.isValidElement(children) ? { render: children as React.ReactElement } : {};

    return (
      <MenuPrimitive.Trigger
        ref={ref}
        className={cn('cursor-pointer outline-none', className)}
        {...renderProps}
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
        'bg-surface3 text-neutral4 data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1 z-50 min-w-44 max-h-[min(20rem,var(--radix-dropdown-menu-content-available-height))] overflow-x-hidden overflow-y-auto rounded-xl border border-border1 p-1 shadow-dialog',
        className,
      )}
      {...props}
    />
  ),
);
DropdownMenuItem.displayName = 'DropdownMenuItem';

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content> & {
    container?: HTMLElement;
  }
>(({ className, container, sideOffset = 8, ...props }, ref) => {
  return (
    <DropdownMenuPrimitive.Portal container={container}>
      <DropdownMenuPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          'bg-surface3 data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1 text-neutral4 z-50 min-w-44 max-h-[min(20rem,var(--radix-dropdown-menu-content-available-height))] overflow-x-hidden overflow-y-auto rounded-xl border border-border1 p-1 shadow-dialog',
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
});
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

const DropdownMenuRadioItem = React.forwardRef<HTMLDivElement, MenuPrimitive.RadioItem.Props>(
  ({ className, children, ...props }, ref) => (
    <MenuPrimitive.RadioItem
      ref={ref}
      className={cn(
        'relative flex cursor-pointer select-none items-center rounded-lg py-1.5 pl-8 pr-2 text-ui-smd leading-ui-sm transition-colors text-neutral4 hover:text-neutral6 focus:text-neutral6 hover:bg-surface4 focus:bg-surface4 data-[highlighted]:bg-surface4 data-[highlighted]:text-neutral6 data-disabled:cursor-not-allowed data-disabled:opacity-50 data-disabled:hover:bg-transparent data-disabled:hover:text-neutral4 data-disabled:focus:bg-transparent data-disabled:focus:text-neutral4 data-disabled:data-[highlighted]:bg-transparent data-disabled:data-[highlighted]:text-neutral4 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0',
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <MenuPrimitive.RadioItemIndicator>
          <Circle className="h-2 w-2 fill-current" />
        </MenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </MenuPrimitive.RadioItem>
  ),
);
DropdownMenuRadioItem.displayName = 'DropdownMenuRadioItem';

const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(itemClass, 'w-full', className)}
    checked={checked}
    {...props}
  >
    <div className="border border-border2 flex h-4 w-4 items-center justify-center rounded-sm">
      {checked && <CheckIcon />}
    </div>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
));
DropdownMenuCheckboxItem.displayName = DropdownMenuPrimitive.CheckboxItem.displayName;

const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      'relative flex cursor-pointer select-none items-center rounded-lg py-1.5 pl-8 pr-2 text-ui-smd leading-ui-sm transition-colors text-neutral4 hover:text-neutral6 focus:text-neutral6 hover:bg-surface4 focus:bg-surface4 data-[highlighted]:bg-surface4 data-[highlighted]:text-neutral6 data-disabled:pointer-events-none data-disabled:opacity-50 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0',
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Circle className="h-2 w-2 fill-current" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
));
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName;

const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn(
      'px-2 pt-1.5 pb-1 text-ui-xs font-medium uppercase tracking-wider text-neutral3',
      inset && 'pl-8',
      className,
    )}
    {...props}
  />
));
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator ref={ref} className={cn('bg-border1 -mx-1 my-1 h-px', className)} {...props} />
));
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

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
