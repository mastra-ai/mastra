import type { ComponentPropsWithoutRef, HTMLAttributes, ReactNode } from 'react';

import { CommandDialog, CommandInput, CommandItem, CommandList, CommandShortcut } from '@/ds/components/Command';
import { Kbd } from '@/ds/components/Kbd';
import { ScrollArea } from '@/ds/components/ScrollArea';
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
      overlayClassName={cn('bg-surface1/40 backdrop-blur-none', overlayClassName)}
      contentClassName={cn(
        'command-palette-popup max-w-[min(56rem,calc(100vw-2rem))] overflow-visible border-none bg-transparent p-0 shadow-none backdrop-blur-none sm:max-w-[min(56rem,calc(100vw-2rem))]',
        contentClassName,
      )}
      commandClassName={cn(
        // Height lives in `.command-palette-shell` — see command-palette.css.
        'command-palette-shell gap-2 overflow-visible rounded-none bg-transparent text-neutral4 shadow-none backdrop-blur-none',
        '[&_[data-slot=command-input-wrapper]]:h-14 [&_[data-slot=command-input-wrapper]]:shrink-0 [&_[data-slot=command-input-wrapper]]:rounded-xl [&_[data-slot=command-input-wrapper]]:border [&_[data-slot=command-input-wrapper]]:border-border1 [&_[data-slot=command-input-wrapper]]:bg-surface3 [&_[data-slot=command-input-wrapper]]:px-4 [&_[data-slot=command-input-wrapper]]:shadow-[0_6px_18px_-16px_rgb(0_0_0_/_0.55)]',
        '[&_[data-slot=command-input-wrapper]]:pr-11 [&_[data-slot=command-input-wrapper]]:transition-[border-color,box-shadow] [&_[data-slot=command-input-wrapper]]:duration-150 [&_[data-slot=command-input-wrapper]]:ease-out [&_[data-slot=command-input-wrapper]_svg]:text-neutral4 [&_[data-slot=command-input-wrapper]:focus-within]:border-border1 [&_[data-slot=command-input-wrapper]:focus-within]:bg-surface3 [&_[data-slot=command-input-wrapper]:focus-within]:shadow-[0_8px_22px_-18px_rgb(0_0_0_/_0.6)]',
        '**:[[cmdk-input]]:h-full **:[[cmdk-input]]:text-ui-md',
        '**:[[cmdk-group-heading]]:px-3 **:[[cmdk-group-heading]]:pt-3 **:[[cmdk-group-heading]]:pb-2 **:[[cmdk-group]]:p-0',
        '**:[[cmdk-item]]:px-3 **:[[cmdk-item]]:py-2.5',
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
      wrapperClassName={cn('command-palette-surface command-palette-surface-input', wrapperClassName)}
      {...props}
    />
  );
}

function CommandPaletteBody({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className="min-h-0 flex-1 rounded-2xl">
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
        'command-palette-surface command-palette-surface-rail flex max-h-[min(14rem,32dvh)] min-h-0 flex-col overflow-hidden rounded-2xl border border-border1 bg-surface2 p-3 shadow-[0_8px_24px_-20px_rgb(0_0_0_/_0.55)] md:h-full md:max-h-none',
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
      // eslint-disable-next-line tailwindcss/no-unnecessary-arbitrary-value -- v4 emits nothing for `scale-0.99`
      className="text-ui-smd leading-ui-sm text-neutral3 hover:border-border1 hover:bg-surface4 hover:text-neutral6 data-[active=true]:border-border1 data-[active=true]:bg-surface4 data-[active=true]:text-neutral6 flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg border border-transparent px-2.5 text-left transition-[background-color,border-color,color,transform] duration-150 ease-out active:scale-[0.99]"
      data-active={active}
      aria-pressed={active}
      onClick={onSelect}
    >
      <span className="flex size-4 shrink-0 items-center justify-center [&>svg]:size-4">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="border-border1 bg-surface4/70 text-neutral3 rounded-md border px-1.5 py-0.5 text-[10px] leading-none">
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
      className="command-palette-surface command-palette-surface-results command-palette-results-panel border-border1 bg-surface2 relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border shadow-[0_10px_28px_-22px_rgb(0_0_0_/_0.6)]"
      {...props}
    >
      <CommandList
        scrollArea
        scrollAreaClassName="min-h-0 flex-1 rounded-none"
        scrollAreaViewportClassName="command-palette-scroll-viewport"
        className="command-palette-list max-h-none rounded-none border-none bg-transparent shadow-none"
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
        'group h-auto items-start gap-3 rounded-xl border border-transparent px-3 py-2.5 data-[selected=true]:border-border1 data-[selected=true]:bg-surface4/80',
        'transition-[background-color,border-color] duration-150 ease-out',
        className,
      )}
      {...props}
    >
      <span className="text-neutral3 group-data-[selected=true]:text-neutral6 mt-0.5 flex size-4 max-w-4 min-w-4 shrink-0 basis-4 items-center justify-center transition-colors duration-150 ease-out [&>svg]:!size-4 [&>svg]:shrink-0">
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-ui-smd leading-ui-sm text-neutral6 truncate font-medium">{title}</span>
          {badge && (
            <span className="border-border1 bg-surface4/60 text-neutral3 shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] leading-none font-medium uppercase">
              {badge}
            </span>
          )}
        </span>
        {(subtitle || path) && (
          <span className="text-ui-xs leading-ui-xs text-neutral3 flex min-w-0 items-center gap-2">
            {subtitle && <span className="truncate">{subtitle}</span>}
            {path && (
              <span className="border-border1 bg-surface4/70 text-neutral3 max-w-52 truncate rounded-md border px-1.5 py-0.5 font-mono text-[10px] leading-none">
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
    <div className="command-palette-footer text-ui-xs text-neutral3 pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-3 px-4 pt-5 pb-2">
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
