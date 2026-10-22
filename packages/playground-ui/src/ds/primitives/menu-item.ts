import { cn } from '../../lib/utils';
import { buttonVariants } from '../components/Button/Button';
import { overlaySurfaceStyle } from './raised-surface';
import { controlStateColorTransition } from './transitions';

// Shared recipe for items rendered inside floating menus (DropdownMenu, ContextMenu,
// Select, Combobox, PropertyFilter). An item shares ghost/md Button interaction
// states, with its own reading typography and insets. `rounded-lg` lets stacked items sit
// concentrically inside a `rounded-xl p-1` popup. Base UI drives keyboard/pointer
// highlight via `data-highlighted`, which `:hover` alone does not cover.
// `flex` (not Button's `inline-flex`): popups size to their content (`w-max`), and
// inline-level items would be measured side by side on one line, stretching the popup
// to the full available width instead of the widest item.
const MENU_ITEM_OVERRIDES = cn(
  'flex w-full justify-start gap-2 rounded-lg px-2 text-left text-menu text-muted-foreground select-none',
  // Leading icons and trailing chevrons share a tone that follows pointer,
  // keyboard, and held-open submenu states together with the label.
  '[--menu-icon-color:var(--placeholder)] [&>svg]:text-(color:--menu-icon-color)',
  '[&>svg]:transition-[color] [&>svg]:duration-fast [&>svg]:ease-out-custom motion-reduce:[&>svg]:transition-none',
  // An item may carry a second line (a name over its description). The Button
  // height becomes the floor so single-line rows keep the control rhythm and a
  // taller item grows instead of overflowing into its neighbour.
  'h-auto min-h-control-md py-1',
  // Button brightens its border on focus-visible; inside a menu the highlight is the focus cue.
  'focus-visible:border-transparent',
  // No row background: the popup's FluidMenuItems highlight travels between rows;
  // the row only lifts its text color. Same modifiers as Button's ghost fills so
  // tailwind-merge drops them; any other spelling leaves both surfaces painted.
  'not-disabled:hover:bg-transparent not-disabled:active:bg-transparent',
  'not-disabled:hover:text-foreground/80 data-highlighted:text-foreground/80 data-selected:text-foreground/80 data-[popup-open]:text-foreground/80',
  'not-disabled:hover:[--menu-icon-color:var(--muted-foreground)] data-highlighted:[--menu-icon-color:var(--muted-foreground)]',
  'data-selected:[--menu-icon-color:var(--muted-foreground)] data-[popup-open]:[--menu-icon-color:var(--muted-foreground)]',
  'data-disabled:pointer-events-none data-disabled:cursor-not-allowed data-disabled:opacity-50',
  '[&>span]:truncate',
  // Button pulls iconed labels toward its pill edge. A menu uses the same inset
  // with or without an icon, so labels and submenu values follow a stable grid.
  'has-[>svg]:px-2',
);

export const menuItemClass = cn(buttonVariants({ variant: 'ghost', size: 'md' }), MENU_ITEM_OVERRIDES);

export const menuItemDestructiveClass = cn(
  buttonVariants({ variant: 'destructive-ghost', size: 'md' }),
  MENU_ITEM_OVERRIDES,
  'text-destructive-foreground not-disabled:hover:text-destructive-foreground [&>svg]:text-destructive-foreground',
  'data-highlighted:text-destructive-foreground data-selected:text-destructive-foreground data-[popup-open]:text-destructive-foreground',
);

// Trailing indicator (check / submenu chevron) — applied to a wrapper element, not the
// svg itself, so the Button recipe's `[&>svg]` adornment padding never treats it as a leading icon.
export const menuItemTrailingIconClass = cn(
  'ml-auto flex size-icon-sm shrink-0 items-center justify-center text-(color:--menu-icon-color) [&>svg]:size-full',
  controlStateColorTransition,
);

export const menuItemCheckClass = cn(menuItemTrailingIconClass, 'text-muted-foreground');

export const menuItemHintClass = 'ml-auto min-w-0 truncate pl-4 text-muted-foreground';

// Left padding matching icon width + gap, for items aligned with iconed siblings.
export const menuItemInsetClass = 'pl-[calc(var(--spacing-icon-md)+var(--spacing)*4+1px)]';

export const MENU_SIDE_OFFSET = 4;

// A hidden anchor makes Floating UI fall back to the top-left corner, so the popup goes with it.
export const menuPositionerClass = 'z-50 outline-none data-[anchor-hidden]:hidden';

// Width: at least the anchor (or 11rem), otherwise as wide as the widest item, never
// wider than the space Floating UI reports. Shared by every menu-like popup.
export const menuPopupClass = cn(
  'z-50 max-h-[min(var(--spacing-dropdown),var(--available-height))]',
  'w-max max-w-(--available-width) min-w-[max(11rem,var(--anchor-width))]',
  'origin-[var(--transform-origin)] overflow-x-hidden overflow-y-auto',
  // `scrollbar-inset-xl` keeps a ScrollArea's scrollbar ends clear of the `rounded-xl` corners.
  cn('rounded-xl p-1 font-body text-menu text-muted-foreground outline-none scrollbar-inset-xl', overlaySurfaceStyle),
  // A destructive row tints the travelling highlight instead of painting its own.
  '[&:has([data-variant=destructive][data-fluid-hover-active])_[data-slot=fluid-hover-highlight]]:bg-destructive-subtle',
  'data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95 data-[open]:animate-in data-[open]:fade-in-0 data-[open]:zoom-in-95',
  'data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1',
);

// Section labels use the same side inset as rows, including their transparent border.
export const menuLabelClass =
  'px-[calc(var(--spacing)*2+1px)] pt-1.5 pb-1 text-caption tracking-normal text-muted-foreground';

export const menuLabelInsetClass = menuItemInsetClass;

export const menuSeparatorClass = '-mx-1 my-1 h-px bg-border';

export const menuShortcutClass = 'ml-auto pl-4 text-caption tracking-normal text-muted-foreground tabular-nums';

/** Non-interactive row (empty / loading) on the same size grid as an item. */
export const menuEmptyClass =
  'flex h-control-md items-center gap-2 px-2 py-0.5 text-menu text-muted-foreground box-content';

export const menuSearchClasses = {
  // The input is a full control rung and the row adds `py-0.5` on top, so the search
  // row sits one notch taller than an item: the divider does not crowd the first
  // option while the text stays on the item grid.
  container: 'flex items-center gap-2 border-b border-border px-2 py-0.5 text-menu focus-within:bg-fill-subtle',
  icon: 'size-icon-md shrink-0 text-muted-foreground',
  input:
    'h-control-md w-full bg-transparent text-menu text-muted-foreground outline-hidden placeholder:text-muted-foreground',
};
