import { cva } from 'class-variance-authority';
import { buttonVariants } from '../Button/button-variants';
import type { TextButtonSize } from '../Button/button-variants';
import { controlTriggerOpenState } from '@/ds/primitives/control-size';
import type { ControlTriggerVisualVariant } from '@/ds/primitives/control-size';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

/**
 * A combobox is a form field, so it reuses the same button looks as everywhere,
 * mirroring `SelectTrigger`: `default` (the Button's filled default surface —
 * the default here too), `outline` (bordered, transparent) and `ghost`
 * (borderless, for breadcrumbs/inline pickers). Only the high-emphasis `primary`
 * look is intentionally NOT offered (a field is not a call-to-action).
 */
export type ComboboxVisualVariant = ControlTriggerVisualVariant;
export type ComboboxLegacyVariant = 'link';
export type ComboboxVariant = ComboboxVisualVariant | ComboboxLegacyVariant;

function normalizeComboboxVariant(variant: ComboboxVariant): ComboboxVisualVariant {
  return variant === 'link' ? 'ghost' : variant;
}

/**
 * Single source of truth for both the single- and multi-select combobox
 * triggers. A combobox = a button + a trailing chevron, so it reuses the Button
 * recipe (variant colors, size = height/text/padding/radius, unified border
 * focus, disabled) and layers only the combobox-specific extras — exactly like
 * `SelectTrigger`.
 */
export function comboboxTriggerClass({
  variant,
  size,
  error,
  className,
}: {
  variant: ComboboxVariant;
  size: TextButtonSize;
  error?: boolean;
  className?: string;
}): string {
  const visualVariant = normalizeComboboxVariant(variant);

  return cn(
    buttonVariants({ variant: visualVariant, size }),
    // Fill the field and push the value left / chevron right (Button's base
    // centers its content with `justify-center`).
    'w-full min-w-32 justify-between',
    // Read as "active" while the popup is open, per variant (see map above).
    controlTriggerOpenState[visualVariant],
    'data-[placeholder]:text-neutral3',
    error && 'border-error hover:border-error focus-visible:border-error',
    className,
  );
}

export const comboboxItemClass = cva(
  cn(
    'relative flex cursor-pointer items-center rounded-md select-none',
    'min-h-8 py-1.5',
    'text-ui-smd leading-ui-sm text-neutral4',
    'outline-none focus:outline-none focus-visible:outline-none',
    transitions.colors,
    'data-highlighted:bg-surface4 data-highlighted:text-neutral6',
    'data-selected:text-neutral6',
  ),
  {
    variants: {
      multiple: {
        false: 'gap-2 pr-2 pl-2.5',
        true: 'gap-2 pr-2 pl-2.5',
      },
    },
    defaultVariants: {
      multiple: false,
    },
  },
);

export const comboboxStyles = {
  /** Root wrapper */
  root: 'flex flex-col gap-1.5',

  /** Chevron icon in trigger — inherits the variant's text color via currentColor. */
  chevron: 'ml-2 h-4 w-4 shrink-0 opacity-60',

  /** Placeholder text color */
  placeholder: 'text-neutral3',

  /** Popup container — concentric with rounded-xl + p-1 (8px items inside 12px container). */
  popup: cn(
    'w-max max-w-(--available-width) min-w-(--anchor-width) rounded-xl border border-border1 bg-surface3 text-neutral4',
    'shadow-dialog',
    'origin-(--transform-origin)',
    'transition-[transform,scale,opacity] duration-150 ease-out',
    'data-starting-style:scale-95 data-starting-style:opacity-0',
    'data-ending-style:scale-95 data-ending-style:opacity-0',
  ),

  /** Positioner */
  positioner: 'z-50 pointer-events-auto',

  /** Search input container — borderless top section, hairline divider below. */
  searchContainer: cn('flex items-center border-b border-border1 px-2.5 py-1.5', transitions.colors),

  /** Search icon */
  searchIcon: cn('mr-2 size-3.5 shrink-0 text-neutral3', transitions.colors),

  /** Search input */
  searchInput: cn(
    'flex h-7 w-full rounded-md bg-transparent py-1 text-ui-smd leading-ui-sm text-neutral6',
    'placeholder:text-neutral3 disabled:cursor-not-allowed disabled:opacity-50',
    'outline-none focus:outline-none focus-visible:outline-none',
    transitions.colors,
  ),

  /** Empty state */
  empty: 'not-empty:block hidden py-4 text-center text-ui-smd text-neutral3',

  /** Options list */
  list: 'max-h-dropdown-max-height overflow-y-auto overflow-x-hidden p-1',

  /** Option item base — rounded-md sits concentrically inside rounded-xl + p-1. */
  item: comboboxItemClass({ multiple: false }),

  /** Multi-select item — same item rhythm with a right-aligned selected check. */
  itemMulti: comboboxItemClass({ multiple: true }),

  /** Right-aligned slot grouping end content + selection check. */
  itemRightSlot: 'ml-auto flex items-center gap-2 shrink-0',

  /** Check indicator container — inline, fixed 16x16, shown only when item is selected. */
  checkContainer: 'flex h-4 w-4 shrink-0 items-center justify-center text-neutral6',

  /** Check icon (single select) */
  checkIcon: 'h-3.5 w-3.5',

  /** Option label/description wrapper */
  optionText: 'flex flex-col gap-0.5 min-w-0',

  /** Option label */
  optionLabel: 'truncate',

  /** Option description */
  optionDescription: 'text-ui-sm text-neutral3 truncate',

  /** Option end slot — `ml-auto` makes it push right inside flex containers (used by multi-select). */
  optionEnd: 'ml-auto flex items-center shrink-0',

  /** Error message */
  error: 'text-ui-sm text-accent2',
} as const;
