import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { CheckIcon, ChevronDown, Circle } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

const DropdownMenuRoot = DropdownMenuPrimitive.Root;

const DropdownMenuGroup = DropdownMenuPrimitive.Group;

const DropdownMenuPortal = DropdownMenuPrimitive.Portal;

const DropdownMenuSub = DropdownMenuPrimitive.Sub;

const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

const DropdownMenuTrigger = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.Trigger
    ref={ref}
    className={cn(
      'cursor-pointer focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-white/30 focus-visible:rounded-sm',
      className,
    )}
    {...props}
  >
    {children}
  </DropdownMenuPrimitive.Trigger>
));

DropdownMenuTrigger.displayName = DropdownMenuPrimitive.Trigger.displayName;
const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean;
  }
>(({ className, inset, children, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      'hover:bg-surface4 focus:bg-surface4 active:bg-surface5 data-[state=open]:bg-surface4 flex cursor-default select-none items-center rounded-md px-2 py-1.5 text-sm transition-colors text-neutral4 dark:hover:text-white dark:focus:text-white hover:text-neutral6 focus:text-neutral6 focus-visible:outline-hidden focus-visible:ring-0',
      inset && 'pl-8',
      className,
    )}
    {...props}
  >
    {children}
    <ChevronDown className="ml-auto -rotate-90" />
  </DropdownMenuPrimitive.SubTrigger>
));
DropdownMenuSubTrigger.displayName = DropdownMenuPrimitive.SubTrigger.displayName;

const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.SubContent
    ref={ref}
    className={cn(
      'bg-surface3 backdrop-blur-xl data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 z-50 min-w-32 overflow-auto overflow-x-hidden rounded-lg',
      className,
    )}
    {...props}
  />
));
DropdownMenuSubContent.displayName = DropdownMenuPrimitive.SubContent.displayName;

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
          'bg-surface3 data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 backdrop-blur-xl text-neutral4 z-50 min-w-32 overflow-auto rounded-lg p-2 shadow-md',
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
});
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex cursor-pointer select-none items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors text-neutral4 dark:hover:text-white dark:focus:text-white hover:text-neutral6 focus:text-neutral6 hover:bg-surface4 focus:bg-surface4 active:bg-surface5 data-disabled:pointer-events-none data-disabled:opacity-50 [&>span]:truncate [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:outline-hidden focus-visible:ring-0',
      '[&>svg]:w-[1.1em] [&>svg]:h-[1.1em] [&>svg]:opacity-50 [&>svg]:mx-[-.25em] [&:hover>svg]:opacity-100',
      className,
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      'hover:bg-surface4 focus:bg-surface4 active:bg-surface5 dark:hover:text-white dark:focus:text-white hover:text-neutral6 focus:text-neutral6 relative flex w-full cursor-pointer select-none items-center gap-4 rounded-md px-2 py-1.5 text-sm transition-colors text-neutral4 data-disabled:pointer-events-none data-disabled:opacity-50 focus-visible:outline-hidden focus-visible:ring-0',
      className,
    )}
    checked={checked}
    {...props}
  >
    <div className="border dark:border-white/20 border-black/20 flex h-4 w-4 items-center justify-center rounded-sm">
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
      'relative flex cursor-pointer select-none items-center rounded-md py-1.5 pl-8 pr-2 text-sm transition-colors text-neutral4 dark:hover:text-white dark:focus:text-white hover:text-neutral6 focus:text-neutral6 hover:bg-surface4 focus:bg-surface4 active:bg-surface5 data-disabled:pointer-events-none data-disabled:opacity-50 focus-visible:outline-hidden focus-visible:ring-0',
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
    className={cn('px-2 py-1.5 text-sm font-semibold', inset && 'pl-8', className)}
    {...props}
  />
));
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn('dark:bg-white/10 bg-black/10 -mx-1 my-1 h-px', className)}
    {...props}
  />
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
  onOpenChange,
  children,
  modal,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
  modal?: boolean;
}) {
  return (
    <DropdownMenuRoot modal={modal} open={open} onOpenChange={onOpenChange}>
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
