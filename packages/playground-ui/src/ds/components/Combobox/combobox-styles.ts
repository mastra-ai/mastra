import { cn } from '@/lib/utils';
import { transitions } from '@/ds/primitives/transitions';

export const comboboxStyles = {
  /** Root wrapper */
  root: 'flex flex-col gap-1.5',

  /** Trigger base styles (combine with buttonVariants) */
  trigger: 'w-full min-w-32 justify-between',

  /** Trigger with error state */
  triggerError: 'border-accent2',

  /** Chevron icon in trigger */
  chevron: 'ml-2 h-4 w-4 shrink-0 opacity-50',

  /** Placeholder text color */
  placeholder: 'text-neutral3',

  /** Popup container */
  popup: cn(
    'min-w-[var(--anchor-width)] w-max max-w-[500px] rounded-md bg-surface3 text-neutral5',
    'shadow-elevated',
    'origin-[var(--transform-origin)]',
    'transition-[transform,scale,opacity] duration-150 ease-out',
    'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
    'data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
  ),

  /** Positioner */
  positioner: 'z-[100]',

  /** Search input container */
  searchContainer: cn('flex items-center border-b border-border1 px-3 py-2', transitions.colors),

  /** Search icon */
  searchIcon: cn('mr-2 h-4 w-4 shrink-0 text-neutral3', transitions.colors),

  /** Search input */
  searchInput: cn(
    'flex h-8 w-full rounded-md bg-transparent py-1 text-sm',
    'placeholder:text-neutral3 disabled:cursor-not-allowed disabled:opacity-50',
    'outline-none',
    transitions.colors,
  ),

  /** Empty state */
  empty: '[&:not(:empty)]:block hidden py-6 text-center text-sm text-neutral3',

  /** Options list */
  list: 'max-h-dropdown-max-height overflow-y-auto overflow-x-hidden p-1',

  /** Option item base */
  item: cn(
    'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm',
    transitions.colors,
    'data-[highlighted]:bg-surface5 data-[highlighted]:text-neutral5',
  ),

  /** Option item with selected state (single select) */
  itemSelected: 'data-[selected]:bg-accent1Dark data-[selected]:text-accent1',

  /** Check indicator container */
  checkContainer: 'mr-2 flex h-4 w-4 shrink-0 items-center justify-center',

  /** Check icon (single select) */
  checkIcon: cn('h-4 w-4 text-accent1', transitions.opacity),

  /** Checkbox container (multi select) */
  checkbox: 'mr-2 flex h-4 w-4 shrink-0 items-center justify-center rounded border',

  /** Checkbox selected state */
  checkboxSelected: 'bg-accent1 border-accent1',

  /** Checkbox unselected state */
  checkboxUnselected: 'border-border1',

  /** Check icon for checkbox (multi select) */
  checkboxIcon: 'h-3 w-3 text-white',

  /** Option content wrapper */
  optionContent: 'flex items-center gap-2 w-full min-w-0',

  /** Option label/description wrapper */
  optionText: 'flex flex-col gap-0.5 min-w-0',

  /** Option label */
  optionLabel: 'truncate',

  /** Option description */
  optionDescription: 'text-xs text-neutral3 truncate',

  /** Option end slot */
  optionEnd: 'ml-auto',

  /** Error message */
  error: 'text-xs text-accent2',
} as const;
