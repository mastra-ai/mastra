import { Command as CommandPrimitive } from 'cmdk';
import { Search } from 'lucide-react';
import * as React from 'react';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/ds/components/Dialog';
import { ScrollArea } from '@/ds/components/ScrollArea';
import type { ScrollAreaMask } from '@/ds/components/ScrollArea';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

const Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn('flex size-full flex-col overflow-hidden rounded-xl bg-surface3 text-neutral4', className)}
    {...props}
  />
));
Command.displayName = CommandPrimitive.displayName;

type CommandDialogProps = Omit<React.ComponentPropsWithoutRef<typeof Dialog>, 'children'> & {
  children?: React.ReactNode;
  title?: string;
  description?: string;
  contentClassName?: string;
  commandClassName?: string;
  commandLabel?: string;
  showOverlay?: boolean;
  overlayClassName?: string;
};

const CommandDialog = ({
  children,
  title = 'Command Palette',
  description = 'Search for commands and actions',
  contentClassName,
  commandClassName,
  commandLabel,
  showOverlay = false,
  overlayClassName,
  ...props
}: CommandDialogProps) => {
  // Custom filter that preserves DOM order by returning 1 for all matches
  // This prevents cmdk from reordering items by match score
  const filter = React.useCallback((value: string, search: string) => {
    const normalizedValue = value.toLowerCase();
    const normalizedSearch = search.toLowerCase();
    const searchTerms = normalizedSearch.split(/\s+/).filter(Boolean);

    // All search terms must be found in the value
    const matches = searchTerms.every(term => normalizedValue.includes(term));
    return matches ? 1 : 0;
  }, []);

  // Stop propagation to prevent keyboard events from reaching
  // global document-level listeners (e.g., table keyboard nav)
  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') return;

    e.stopPropagation();
  }, []);

  return (
    <Dialog {...props}>
      <DialogContent
        showOverlay={showOverlay}
        overlayClassName={overlayClassName}
        className={cn('overflow-hidden p-0', contentClassName)}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{description}</DialogDescription>
        <Command
          label={commandLabel}
          loop
          filter={filter}
          onKeyDown={handleKeyDown}
          className={cn(
            '[&_[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:text-neutral3',
            '[&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 **:[[cmdk-group]]:px-2',
            '[&_[data-slot=command-input-wrapper]_svg]:size-5',
            '**:[[cmdk-input]]:h-12',
            '**:[[cmdk-item]]:px-2 **:[[cmdk-item]]:py-3',
            '[&_[cmdk-item]_svg]:size-5',
            commandClassName,
          )}
        >
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  );
};

type CommandInputProps = React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input> & {
  rightSlot?: React.ReactNode;
  wrapperClassName?: string;
};

const CommandInput = React.forwardRef<React.ElementRef<typeof CommandPrimitive.Input>, CommandInputProps>(
  ({ className, rightSlot, wrapperClassName, ...props }, ref) => (
    <div
      data-slot="command-input-wrapper"
      className={cn('flex items-center border-b border-border1 px-3', transitions.colors, wrapperClassName)}
    >
      <Search className={cn('mr-2 size-4 shrink-0 text-neutral3', transitions.colors)} />
      <CommandPrimitive.Input
        ref={ref}
        className={cn(
          'flex h-10 min-w-0 flex-1 rounded-md bg-transparent py-3 text-ui-smd leading-ui-sm text-neutral6',
          'placeholder:text-neutral3 disabled:cursor-not-allowed disabled:opacity-50',
          'outline-none focus:outline-none focus-visible:outline-none',
          transitions.colors,
          className,
        )}
        {...props}
      />
      {rightSlot && (
        <div data-slot="command-input-right-slot" className="ml-2 flex shrink-0 items-center text-neutral3">
          {rightSlot}
        </div>
      )}
    </div>
  ),
);
CommandInput.displayName = CommandPrimitive.Input.displayName;

type CommandListProps = React.ComponentPropsWithoutRef<typeof CommandPrimitive.List> & {
  scrollArea?: boolean;
  scrollAreaClassName?: string;
  scrollAreaViewportClassName?: string;
  scrollAreaMask?: ScrollAreaMask;
};

const CommandList = React.forwardRef<React.ElementRef<typeof CommandPrimitive.List>, CommandListProps>(
  (
    { className, scrollArea = false, scrollAreaClassName, scrollAreaViewportClassName, scrollAreaMask, ...props },
    ref,
  ) => {
    const list = (
      <CommandPrimitive.List
        ref={ref}
        className={cn(
          'outline-none focus:outline-none focus-visible:outline-none',
          scrollArea ? 'overflow-visible' : 'max-h-dropdown-max-height overflow-x-hidden overflow-y-auto',
          className,
        )}
        {...props}
      />
    );

    if (!scrollArea) return list;

    return (
      <ScrollArea
        className={cn('min-h-0', scrollAreaClassName)}
        viewPortClassName={scrollAreaViewportClassName}
        mask={scrollAreaMask}
      >
        {list}
      </ScrollArea>
    );
  },
);
CommandList.displayName = CommandPrimitive.List.displayName;

const CommandEmpty = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
  <CommandPrimitive.Empty ref={ref} className="py-6 text-center text-ui-smd text-neutral3" {...props} />
));
CommandEmpty.displayName = CommandPrimitive.Empty.displayName;

const CommandGroup = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      'overflow-hidden p-1 text-neutral4',
      '[&_[cmdk-group-heading]]:text-ui-xs [&_[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:pt-1.5 **:[[cmdk-group-heading]]:pb-1 **:[[cmdk-group-heading]]:tracking-wider **:[[cmdk-group-heading]]:text-neutral3 **:[[cmdk-group-heading]]:uppercase',
      className,
    )}
    {...props}
  />
));
CommandGroup.displayName = CommandPrimitive.Group.displayName;

const CommandSeparator = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator ref={ref} className={cn('-mx-1 h-px bg-border1', className)} {...props} />
));
CommandSeparator.displayName = CommandPrimitive.Separator.displayName;

const CommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-ui-smd leading-ui-sm text-neutral4 select-none',
      'outline-none focus:outline-none focus-visible:outline-none',
      transitions.colors,
      'data-[selected=true]:bg-surface4 data-[selected=true]:text-neutral6',
      'data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50',
      '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-neutral3 data-[selected=true]:[&_svg]:text-neutral6',
      className,
    )}
    {...props}
  />
));
CommandItem.displayName = CommandPrimitive.Item.displayName;

const CommandShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
  return <span className={cn('ml-auto text-ui-xs tracking-wider text-neutral3 tabular-nums', className)} {...props} />;
};
CommandShortcut.displayName = 'CommandShortcut';

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
};
