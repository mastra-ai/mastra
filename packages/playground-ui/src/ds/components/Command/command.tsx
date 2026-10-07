import { Command as CommandPrimitive } from 'cmdk';
import { Search } from 'lucide-react';
import * as React from 'react';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/ds/components/Dialog';
import type { DialogSize } from '@/ds/components/Dialog';
import { ScrollArea, ScrollAreaViewport } from '@/ds/components/ScrollArea';
import type { ScrollAreaMask } from '@/ds/components/ScrollArea';
import { Txt } from '@/ds/components/Txt';
import { FluidMenuItems, useFluidMenu, useFluidMenuItemRef } from '@/ds/primitives/fluid-menu';
import { heightTransition, transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

const Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      'flex size-full flex-col overflow-hidden rounded-xl bg-card text-muted-foreground in-data-[slot=dialog-content]:bg-transparent',
      className,
    )}
    {...props}
  />
));
Command.displayName = CommandPrimitive.displayName;

type CommandDialogVariant = 'default' | 'inset';

const commandDialogContentClasses: Record<CommandDialogVariant, string> = {
  default: 'overflow-hidden py-0',
  inset: 'top-1/4 translate-y-0 overflow-hidden rounded-[calc(var(--radius-xl)+--spacing(1))] bg-muted p-1',
};

const commandDialogCommandClasses: Record<CommandDialogVariant, string> = {
  default: cn(
    '[&_[data-slot=command-input-wrapper]_svg]:size-5',
    '**:[[cmdk-input]]:h-12',
    '[&_[cmdk-item]_svg]:size-5',
  ),
  inset: cn(
    'gap-1',
    '[&_[data-slot=command-input-wrapper]_svg]:size-icon-md',
    '**:[[cmdk-input]]:h-11 **:[[cmdk-input]]:text-label',
    '[&_[cmdk-item]_svg]:size-icon-sm',
    '**:[[cmdk-empty]]:px-4 **:[[cmdk-empty]]:pt-3 **:[[cmdk-empty]]:pb-1 **:[[cmdk-empty]]:text-left **:[[cmdk-empty]]:text-caption',
  ),
};

const commandDialogHeadingCase: Record<CommandDialogVariant, 'upper' | 'sentence'> = {
  default: 'upper',
  inset: 'sentence',
};

const CommandDialogVariantContext = React.createContext<CommandDialogVariant>('default');

const CommandDialogBody = ({
  variant,
  footer,
  children,
}: {
  variant: CommandDialogVariant;
  footer?: React.ReactNode;
  children?: React.ReactNode;
}) => {
  if (variant === 'default') return children;

  return (
    <>
      <div
        data-slot="command-dialog-panel"
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-background"
      >
        {children}
      </div>
      {footer && (
        <div data-slot="command-dialog-footer" className="flex items-center justify-between gap-3 pr-1">
          {footer}
        </div>
      )}
    </>
  );
};

type CommandDialogBaseProps = Omit<React.ComponentPropsWithoutRef<typeof Dialog>, 'children'> & {
  children?: React.ReactNode;
  title?: string;
  description?: string;
  size?: DialogSize;
  contentClassName?: string;
  commandClassName?: string;
  commandLabel?: string;
  showOverlay?: boolean;
  overlayClassName?: string;
};

type CommandDialogProps = CommandDialogBaseProps &
  ({ variant?: 'default'; footer?: never } | { variant: 'inset'; footer?: React.ReactNode });

const CommandDialog = ({
  children,
  variant = 'default',
  footer,
  title = 'Command Palette',
  description = 'Search for commands and actions',
  size,
  contentClassName,
  commandClassName,
  commandLabel,
  showOverlay = false,
  overlayClassName,
  ...props
}: CommandDialogProps) => {
  const filter = React.useCallback((value: string, search: string) => {
    const normalizedValue = value.toLowerCase();
    const normalizedSearch = search.toLowerCase();
    const searchTerms = normalizedSearch.split(/\s+/).filter(Boolean);

    const matches = searchTerms.every(term => normalizedValue.includes(term));
    return matches ? 1 : 0;
  }, []);

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') return;

    e.stopPropagation();
  }, []);

  return (
    <Dialog {...props}>
      <DialogContent
        size={size}
        showOverlay={showOverlay}
        showCloseButton={variant !== 'inset'}
        overlayClassName={overlayClassName}
        className={cn(commandDialogContentClasses[variant], contentClassName)}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{description}</DialogDescription>
        <Command
          label={commandLabel}
          loop
          filter={filter}
          onKeyDown={handleKeyDown}
          data-heading-case={commandDialogHeadingCase[variant]}
          className={cn(
            '**:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:text-column **:[[cmdk-group-heading]]:text-muted-foreground',
            '[&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 **:[[cmdk-group]]:px-2',
            '**:[[cmdk-item]]:p-2',
            commandDialogCommandClasses[variant],
            commandClassName,
          )}
        >
          <CommandDialogVariantContext.Provider value={variant}>
            <CommandDialogBody variant={variant} footer={footer}>
              {children}
            </CommandDialogBody>
          </CommandDialogVariantContext.Provider>
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
      className={cn('flex items-center border-b border-border px-3', transitions.colors, wrapperClassName)}
    >
      <Search className={cn('mr-2 size-4 shrink-0 text-muted-foreground', transitions.colors)} />
      <CommandPrimitive.Input
        ref={ref}
        className={cn(
          'flex h-8 min-w-0 flex-1 rounded-md bg-transparent py-2 text-body-sm text-foreground',
          'placeholder:text-placeholder disabled:cursor-not-allowed disabled:opacity-50',
          'outline-none focus:outline-none focus-visible:outline-none',
          transitions.colors,
          className,
        )}
        {...props}
      />
      {rightSlot && (
        <div data-slot="command-input-right-slot" className="ml-2 flex shrink-0 items-center text-muted-foreground">
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
  /** Extra classes for the travelling hover surface (e.g. a different radius). */
  highlightClassName?: string;
};

const CommandList = React.forwardRef<React.ElementRef<typeof CommandPrimitive.List>, CommandListProps>(
  (
    {
      className,
      children,
      scrollArea = false,
      scrollAreaClassName,
      scrollAreaViewportClassName,
      scrollAreaMask,
      highlightClassName,
      ...props
    },
    ref,
  ) => {
    const menu = useFluidMenu<HTMLDivElement>({ activeAttr: 'data-selected' });
    const animateHeight = React.useContext(CommandDialogVariantContext) === 'inset';
    const list = (
      <CommandPrimitive.List
        className={cn(
          'outline-none focus:outline-none focus-visible:outline-none',
          scrollArea ? 'overflow-visible' : 'max-h-dropdown overflow-x-hidden overflow-y-auto',
          animateHeight && cn('h-(--cmdk-list-height)', heightTransition),
          menu.containerClassName,
          className,
        )}
        {...props}
        {...menu.getContainerProps(props, ref)}
      >
        <FluidMenuItems menu={menu} className={highlightClassName}>
          {children}
        </FluidMenuItems>
      </CommandPrimitive.List>
    );

    if (!scrollArea) return list;

    return (
      <ScrollArea className={cn('min-h-0', scrollAreaClassName)} mask={scrollAreaMask}>
        <ScrollAreaViewport className={scrollAreaViewportClassName}>{list}</ScrollAreaViewport>
      </ScrollArea>
    );
  },
);
CommandList.displayName = CommandPrimitive.List.displayName;

const CommandEmpty = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
  <CommandPrimitive.Empty ref={ref} className="py-6 text-center text-body-sm text-muted-foreground" {...props} />
));
CommandEmpty.displayName = CommandPrimitive.Empty.displayName;

const CommandGroup = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      'overflow-hidden p-1 text-muted-foreground',
      '**:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:pt-1.5 **:[[cmdk-group-heading]]:pb-1 **:[[cmdk-group-heading]]:text-muted-foreground',
      '[&_[cmdk-group-heading]]:text-meta [&_[cmdk-group-heading]]:uppercase',
      'in-data-[heading-case=sentence]:**:[[cmdk-group-heading]]:tracking-normal in-data-[heading-case=sentence]:**:[[cmdk-group-heading]]:normal-case',
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
  <CommandPrimitive.Separator ref={ref} className={cn('-mx-1 h-px bg-border', className)} {...props} />
));
CommandSeparator.displayName = CommandPrimitive.Separator.displayName;

const CommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={useFluidMenuItemRef(ref)}
    className={cn(
      'relative flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-body-sm text-muted-foreground select-none',
      'outline-none focus:outline-none focus-visible:outline-none',
      transitions.colors,
      'data-[selected=true]:text-foreground',
      'data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50',
      '[&_svg]:pointer-events-none [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground data-[selected=true]:[&>svg]:text-foreground',
      className,
    )}
    {...props}
  />
));
CommandItem.displayName = CommandPrimitive.Item.displayName;

const CommandShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <Txt
      as="span"
      variant="meta"
      tone="muted"
      className={cn('ml-auto tracking-wider tabular-nums', className)}
      {...props}
    />
  );
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
