import { buttonVariants } from '@/ds/components/Button/Button';
import { cn } from '@/lib/utils';

// Block-level items keep w-max popups from measuring options side by side.
const MENU_ITEM_OVERRIDES = cn(
  'flex w-full justify-start rounded-lg text-left select-none',
  'ds-focus-item',
  'data-highlighted:bg-neutral6/5 data-highlighted:text-neutral6',
  'data-selected:text-neutral6',
  'data-disabled:pointer-events-none data-disabled:cursor-not-allowed data-disabled:opacity-50',
  '[&>span]:truncate',
);

export const menuItemClass = cn(buttonVariants({ variant: 'ghost', size: 'md' }), MENU_ITEM_OVERRIDES);

export const menuItemDestructiveClass = cn(
  buttonVariants({ variant: 'destructive-ghost', size: 'md' }),
  MENU_ITEM_OVERRIDES,
  'data-highlighted:bg-accent2/10 data-highlighted:text-accent2',
);

// Apply to a wrapper: Button's direct-SVG margins would override ml-auto on the icon.
export const menuItemTrailingIconClass =
  'ml-auto flex size-[1.1em] shrink-0 items-center justify-center [&>svg]:size-full';

export const menuItemCheckClass = cn(menuItemTrailingIconClass, 'text-neutral6');

export const menuItemInsetClass = 'pl-[calc(.9em+1.1em+.75em)]';

export const MENU_SIDE_OFFSET = 4;

// Hide detached popups instead of showing them at the floating fallback origin.
export const menuPositionerClass = 'z-50 outline-none data-[anchor-hidden]:hidden';

export const menuPopupClass = cn(
  'ds-focus-menu z-50 max-h-[min(var(--max-height-dropdown-max-height),var(--available-height))]',
  'w-max max-w-(--available-width) min-w-[max(11rem,var(--anchor-width))]',
  'origin-[var(--transform-origin)] overflow-x-hidden overflow-y-auto',
  'rounded-xl border border-border1 bg-surface3 p-1 text-neutral4 shadow-dialog outline-none',
  'data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95 data-[open]:animate-in data-[open]:fade-in-0 data-[open]:zoom-in-95',
  'data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1',
);

export const menuLabelClass = 'px-[.9em] pt-1.5 pb-1 text-ui-xs font-medium tracking-wider text-neutral3 uppercase';

export const menuSeparatorClass = '-mx-1 my-1 h-px bg-border1';

export const menuShortcutClass = 'ml-auto text-ui-xs tracking-wider text-neutral3 tabular-nums';

export const menuEmptyClass =
  'flex h-form-md items-center gap-[.75em] px-[.9em] py-0.5 text-ui-smd leading-ui-sm text-neutral3 box-content';

export const menuSearchClasses = {
  container: 'flex items-center gap-[.75em] border-b border-border1 px-[.9em] py-0.5 text-ui-smd',
  icon: 'size-[1.1em] shrink-0 text-neutral3',
  input:
    'ds-focus ds-focus-line h-form-md w-full bg-transparent text-ui-smd leading-ui-sm text-neutral6 outline-none placeholder:text-neutral3',
};
