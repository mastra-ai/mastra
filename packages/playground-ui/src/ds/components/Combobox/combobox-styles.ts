import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export const comboboxStyles = {
  /** Root wrapper */
  root: 'flex flex-col gap-1.5',

  /** Trigger — form input look, sized to mirror SelectTrigger. */
  trigger: cn(
    'inline-flex w-full min-w-32 select-none items-center justify-between gap-1.5 whitespace-nowrap',
    'rounded-lg border border-border1 bg-transparent px-2.5 text-ui-smd leading-ui-sm text-neutral4',
    'outline-none transition-colors duration-normal ease-out-custom',
    'hover:bg-surface3 hover:text-neutral6 hover:border-border2 active:bg-surface4',
    'focus:outline-none focus-visible:outline-none focus-visible:border-border2',
    'data-[popup-open]:bg-surface3 data-[popup-open]:text-neutral6 data-[popup-open]:border-border2',
    'disabled:cursor-not-allowed disabled:opacity-50',
  ),

  /** Trigger with error state */
  triggerError: 'border-accent2 hover:border-accent2 focus-visible:border-accent2',

  /** Chevron icon in trigger */
  chevron: 'ml-2 h-4 w-4 shrink-0 text-neutral3 opacity-70',

  /** Placeholder text color */
  placeholder: 'text-neutral3',

  /** Popup container — concentric with rounded-xl + p-1 (8px items inside 12px container). */
  popup: cn(
    'min-w-(--anchor-width) w-max max-w-[500px] rounded-xl border border-border1 bg-surface3 text-neutral4',
    'shadow-dialog',
    'origin-(--transform-origin)',
    'transition-[transform,scale,opacity] duration-150 ease-out',
    'data-starting-style:scale-95 data-starting-style:opacity-0',
    'data-ending-style:scale-95 data-ending-style:opacity-0',
  ),

  /** Positioner */
  positioner: 'z-50 pointer-events-auto',

  /** Search input container — borderless top section, hairline divider below. */
  searchContainer: cn('flex items-center border-b border-border1 px-2.5 py-2', transitions.colors),

  /** Search icon */
  searchIcon: cn('mr-2 h-4 w-4 shrink-0 text-neutral3', transitions.colors),

  /** Search input */
  searchInput: cn(
    'flex h-7 w-full rounded-md bg-transparent py-1 text-ui-smd leading-ui-sm text-neutral6',
    'placeholder:text-neutral3 disabled:cursor-not-allowed disabled:opacity-50',
    'outline-none focus:outline-none focus-visible:outline-none',
    transitions.colors,
  ),

  /** Empty state */
  empty: 'not-empty:block hidden py-6 text-center text-ui-smd text-neutral3',

  /** Options list */
  list: 'max-h-dropdown-max-height overflow-y-auto overflow-x-hidden p-1',

  /** Option item base — rounded-lg (8px) sits concentrically inside rounded-xl + p-1. */
  item: cn(
    'relative flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2 py-1.5',
    'text-ui-smd leading-ui-sm text-neutral4',
    'outline-none focus:outline-none focus-visible:outline-none',
    transitions.colors,
    'data-highlighted:bg-surface4 data-highlighted:text-neutral6',
  ),

  /** Option item with selected state (single select) — quiet emphasis, no accent fill. */
  itemSelected: 'data-selected:text-neutral6',

  /** Check indicator container */
  checkContainer: 'flex h-4 w-4 shrink-0 items-center justify-center',

  /** Check icon (single select) */
  checkIcon: cn('h-4 w-4 text-neutral6', transitions.opacity),

  /** Checkbox container (multi select) */
  checkbox: 'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border',

  /** Checkbox selected state */
  checkboxSelected: 'bg-accent1 border-accent1',

  /** Checkbox unselected state */
  checkboxUnselected: 'border-border2',

  /** Check icon for checkbox (multi select) */
  checkboxIcon: 'h-3 w-3 text-surface1',

  /** Option content wrapper */
  optionContent: 'flex items-center gap-2 w-full min-w-0',

  /** Option label/description wrapper */
  optionText: 'flex flex-col gap-0.5 min-w-0',

  /** Option label */
  optionLabel: 'truncate',

  /** Option description */
  optionDescription: 'text-ui-sm text-neutral3 truncate',

  /** Option end slot */
  optionEnd: 'ml-auto',

  /** Error message */
  error: 'text-ui-sm text-accent2',
} as const;
