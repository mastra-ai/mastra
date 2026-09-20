import { buttonVariants } from '@/ds/components/Button/Button';
import { cn } from '@/lib/utils';

// Shared recipe for items rendered inside floating menus (DropdownMenu, ContextMenu,
// Select, Combobox, PropertyFilter, DataFilter). An item is a ghost/md Button laid out
// left-aligned, with `rounded-lg` instead of the pill radius so stacked items sit
// concentrically inside a `rounded-xl p-1` popup. Base UI drives keyboard/pointer
// highlight via `data-highlighted`, which `:hover` alone does not cover.
// `flex` (not Button's `inline-flex`): popups size to their content (`w-max`), and
// inline-level items would be measured side by side on one line, stretching the popup
// to the full available width instead of the widest item.
const MENU_ITEM_OVERRIDES = cn(
  'flex w-full justify-start rounded-lg text-left select-none',
  // Button brightens its border on focus-visible; inside a menu the highlight is the focus cue.
  'focus-visible:border-transparent',
  // No row background: the popup's FluidMenuItems highlight travels between rows;
  // the row only lifts its text color.
  'hover:bg-transparent data-highlighted:text-foreground',
  'data-selected:text-foreground',
  'data-disabled:pointer-events-none data-disabled:cursor-not-allowed data-disabled:opacity-50',
  '[&>span]:truncate',
);

export const menuItemClass = cn(buttonVariants({ variant: 'ghost', size: 'md' }), MENU_ITEM_OVERRIDES);

export const menuItemDestructiveClass = cn(
  buttonVariants({ variant: 'destructive-ghost', size: 'md' }),
  MENU_ITEM_OVERRIDES,
  'data-highlighted:bg-destructive/20 data-highlighted:text-destructive',
);

// Trailing indicator (check / submenu chevron) — applied to a wrapper element, not the
// svg itself, because the Button recipe's `[&>svg]:mx-[-.3em]` would beat `ml-auto`.
export const menuItemTrailingIconClass =
  'ml-auto flex size-[1.1em] shrink-0 items-center justify-center [&>svg]:size-full';

export const menuItemCheckClass = cn(menuItemTrailingIconClass, 'text-foreground');

// Left padding matching icon width + gap, for items aligned with iconed siblings.
export const menuItemInsetClass = 'pl-[calc(.9em+1.1em+.75em)]';

export const MENU_SIDE_OFFSET = 4;

// A hidden anchor makes Floating UI fall back to the top-left corner, so the popup goes with it.
export const menuPositionerClass = 'z-50 outline-none data-[anchor-hidden]:hidden';

// Width: at least the anchor (or 11rem), otherwise as wide as the widest item, never
// wider than the space Floating UI reports. Shared by every menu-like popup.
export const menuPopupClass = cn(
  'z-50 max-h-[min(var(--max-height-dropdown-max-height),var(--available-height))]',
  'w-max max-w-(--available-width) min-w-[max(11rem,var(--anchor-width))]',
  'origin-[var(--transform-origin)] overflow-x-hidden overflow-y-auto',
  'new-theme rounded-xl border border-border bg-popover p-1 text-foreground/90 shadow-dialog outline-none',
  'data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95 data-[open]:animate-in data-[open]:fade-in-0 data-[open]:zoom-in-95',
  'data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1',
);

export const menuLabelClass =
  'px-[.9em] pt-1.5 pb-1 text-ui-xs font-medium tracking-wider text-muted-foreground uppercase';

export const menuSeparatorClass = '-mx-1 my-1 h-px bg-border';

export const menuShortcutClass = 'ml-auto text-ui-xs tracking-wider text-muted-foreground tabular-nums';

/** Non-interactive row (empty / loading) on the same size grid as an item. */
export const menuEmptyClass =
  'flex h-form-md items-center gap-[.75em] px-[.9em] py-0.5 text-ui-smd text-muted-foreground box-content';

export const menuSearchClasses = {
  // Row = h-form-md input + py-0.5 → 32px, one notch above the 28px items so the
  // divider does not crowd the first option while the text stays on the item grid.
  container: 'flex items-center gap-[.75em] border-b border-border px-[.9em] py-0.5 text-ui-smd',
  icon: 'size-[1.1em] shrink-0 text-muted-foreground',
  input:
    'h-form-md w-full bg-transparent text-ui-smd text-foreground outline-hidden placeholder:text-muted-foreground focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-foreground/45 focus-visible:outline-solid',
};
