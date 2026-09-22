import type { ComponentPropsWithoutRef, HTMLAttributes, ReactNode } from 'react';

import { CommandDialog, CommandInput, CommandItem, CommandList, CommandShortcut } from '@/ds/components/Command';
import { Kbd } from '@/ds/components/Kbd';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { inputSurfaceAndFocusWithinStyle } from '@/ds/primitives/form-element';
import { overlaySurfaceStyle } from '@/ds/primitives/raised-surface';
import { controlStateColorTransition } from '@/ds/primitives/transitions';
import { quietTextHover } from '@/ds/primitives/typography';
import { cn } from '@/lib/utils';

import './command-palette.css';

type CommandPaletteDialogProps = ComponentPropsWithoutRef<typeof CommandDialog>;

function CommandPaletteDialog({
  children,
  contentClassName,
  commandClassName,
  showOverlay = true,
  overlayClassName,
  ...props
}: CommandPaletteDialogProps) {
  return (
    <CommandDialog
      showOverlay={showOverlay}
      overlayClassName={cn('bg-sidebar/40 backdrop-blur-none', overlayClassName)}
      contentClassName={cn(
        'command-palette-popup max-w-[min(56rem,calc(100vw-2rem))] overflow-visible border-none bg-transparent p-0 shadow-none backdrop-blur-none sm:max-w-[min(56rem,calc(100vw-2rem))]',
        contentClassName,
      )}
      commandClassName={cn(
        // Height lives in `.command-palette-shell` — see command-palette.css.
        'command-palette-shell gap-2 overflow-visible rounded-none bg-transparent text-muted-foreground shadow-none backdrop-blur-none',
        '[&_[data-slot=command-input-wrapper]_svg]:text-muted-foreground',
        '**:[[cmdk-input]]:h-full **:[[cmdk-input]]:text-body',
        '**:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:pt-2 **:[[cmdk-group-heading]]:pb-1 **:[[cmdk-group]]:p-0',
        '**:[[cmdk-item]]:px-2 **:[[cmdk-item]]:py-1.5',
        commandClassName,
      )}
      {...props}
    >
      {children}
    </CommandDialog>
  );
}

type CommandPaletteInputProps = ComponentPropsWithoutRef<typeof CommandInput>;

function CommandPaletteInput({ wrapperClassName, ...props }: CommandPaletteInputProps) {
  return (
    <CommandInput
      wrapperClassName={cn(
        'command-palette-surface command-palette-surface-input',
        inputSurfaceAndFocusWithinStyle,
        // `border-0` because `CommandInput`'s own `border-b` is the separator of a single-panel
        // Command; here the input is a detached pill and the material already carries its rim.
        'h-11 shrink-0 rounded-xl border-0 px-3 pr-11',
        wrapperClassName,
      )}
      {...props}
    />
  );
}

function CommandPaletteBody({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className="min-h-0 flex-1">
      <div
        className={cn(
          'grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2 md:grid-cols-[13rem_minmax(0,1fr)] md:grid-rows-none',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </div>
  );
}

type CommandPaletteRailProps = ComponentPropsWithoutRef<'aside'> & {
  'aria-label': string;
};

function CommandPaletteRail({ children, className, ...props }: CommandPaletteRailProps) {
  return (
    <aside
      className={cn(
        'command-palette-surface command-palette-surface-rail flex max-h-[min(14rem,32dvh)] min-h-0 flex-col overflow-hidden rounded-xl p-2 md:h-full md:max-h-none',
        overlaySurfaceStyle,
        className,
      )}
      {...props}
    >
      <ScrollArea className="-m-1 min-h-0 flex-1 p-1" viewPortClassName="pr-1">
        <div className="flex flex-col gap-1">{children}</div>
      </ScrollArea>
    </aside>
  );
}

function CommandPaletteScope({
  icon,
  label,
  count,
  active,
  onSelect,
}: {
  icon: ReactNode;
  label: string;
  count: number;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        quietTextHover,
        'text-body-sm hover:border-border hover:bg-fill-subtle data-[active=true]:border-border data-[active=true]:bg-fill-hover data-[active=true]:text-foreground flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg border border-transparent px-2.5 text-left',
        // eslint-disable-next-line tailwindcss/no-unnecessary-arbitrary-value -- v4 emits nothing for `scale-0.99`
        'transition-[color,transform] duration-fast ease-out-custom motion-reduce:transition-none active:scale-[0.99]',
      )}
      data-active={active}
      aria-pressed={active}
      onClick={onSelect}
    >
      <span className="flex size-4 shrink-0 items-center justify-center [&>svg]:size-4">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="border-border bg-muted/70 text-meta text-muted-foreground rounded-md border px-1.5 py-0.5 leading-none">
        {count}
      </span>
    </button>
  );
}

type CommandPaletteResultsProps = {
  'aria-label': string;
  children: ReactNode;
  footer?: ReactNode;
};

function CommandPaletteResults({ children, footer, ...props }: CommandPaletteResultsProps) {
  return (
    <div
      role="region"
      className={cn(
        'command-palette-surface command-palette-surface-results command-palette-results-panel relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl',
        overlaySurfaceStyle,
      )}
      {...props}
    >
      <CommandList
        scrollArea
        scrollAreaClassName="min-h-0 flex-1 rounded-none"
        scrollAreaViewportClassName="command-palette-scroll-viewport"
        className="command-palette-list max-h-none rounded-none border-none bg-transparent shadow-none"
        highlightClassName="rounded-lg"
      >
        {children}
      </CommandList>
      {footer}
    </div>
  );
}

type CommandPaletteItemProps = Omit<ComponentPropsWithoutRef<typeof CommandItem>, 'children'> & {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  path?: string;
  badge?: string;
  shortcut?: ReactNode;
};

function CommandPaletteItem({
  icon,
  title,
  subtitle,
  path,
  badge,
  shortcut,
  className,
  ...props
}: CommandPaletteItemProps) {
  return (
    <CommandItem
      className={cn(
        'group h-auto items-start gap-3 rounded-lg border border-transparent px-3 py-2.5 data-[selected=true]:border-border',
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          'text-muted-foreground group-data-[selected=true]:text-foreground mt-0.5 flex size-4 max-w-4 min-w-4 shrink-0 basis-4 items-center justify-center [&>svg]:!size-4 [&>svg]:shrink-0',
          controlStateColorTransition,
        )}
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-label text-foreground truncate">{title}</span>
          {badge && (
            <span className="border-border bg-muted/60 text-meta text-muted-foreground shrink-0 rounded-md border px-1.5 py-0.5 leading-none uppercase">
              {badge}
            </span>
          )}
        </span>
        {(subtitle || path) && (
          <span className="text-meta text-muted-foreground flex min-w-0 items-center gap-2">
            {subtitle && <span className="truncate">{subtitle}</span>}
            {path && (
              <span className="border-border bg-muted/70 text-meta text-muted-foreground max-w-52 truncate rounded-md border px-1.5 py-0.5 font-mono leading-none">
                {path}
              </span>
            )}
          </span>
        )}
      </span>
      {shortcut && <CommandShortcut>{shortcut}</CommandShortcut>}
    </CommandItem>
  );
}

function CommandPaletteFooter({ label }: { label: string }) {
  return (
    <div className="command-palette-footer text-meta text-muted-foreground pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-3 px-3 pt-3 pb-2">
      <span className="truncate">{label}</span>
      <span className="flex shrink-0 items-center gap-1.5">
        <Kbd size="sm">↑</Kbd>
        <Kbd size="sm">↓</Kbd>
        <Kbd size="sm">↵</Kbd>
        <Kbd size="sm">Esc</Kbd>
      </span>
    </div>
  );
}

export {
  CommandPaletteBody,
  CommandPaletteDialog,
  CommandPaletteFooter,
  CommandPaletteInput,
  CommandPaletteItem,
  CommandPaletteRail,
  CommandPaletteResults,
  CommandPaletteScope,
};
