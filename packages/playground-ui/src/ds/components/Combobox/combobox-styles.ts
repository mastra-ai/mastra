import { cva } from 'class-variance-authority';
import { buttonVariants, isIconButtonSize } from '../Button/Button';
import type { ButtonSize } from '../Button/Button';
import { controlTriggerOpenState } from '@/ds/primitives/control-size';
import type { ControlTriggerVisualVariant } from '@/ds/primitives/control-size';
import { fieldTriggerSurfaceStyle } from '@/ds/primitives/form-element';
import {
  menuItemCheckClass,
  menuItemClass,
  menuPopupClass,
  menuPositionerClass,
  menuSearchClasses,
  menuEmptyClass,
} from '@/ds/primitives/menu-item';
import { cn } from '@/lib/utils';

/**
 * A combobox is a form field, so it reuses the Button's size/shape recipe,
 * mirroring `SelectTrigger`: `default` (the Input's overlay surface — the
 * default here too), `outline` (bordered, transparent) and `ghost`
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
  size: ButtonSize;
  error?: boolean;
  className?: string;
}): string {
  const visualVariant = normalizeComboboxVariant(variant);

  return cn(
    buttonVariants({ variant: visualVariant, size }),
    // The filled look is the Input surface, not the Button one.
    visualVariant === 'default' && fieldTriggerSurfaceStyle,
    // Fill the field and push the value left / chevron right (Button's base
    // centers its content with `justify-center`). Icon sizes are a fixed square
    // showing only the chevron, so they keep Button's centering.
    !isIconButtonSize(size) && 'justify-between text-body-sm',
    // Read as "active" while the popup is open, per variant (see map above).
    controlTriggerOpenState[visualVariant === 'default' ? 'field' : visualVariant],
    'data-[placeholder]:text-muted-foreground',
    error && 'border-destructive hover:border-destructive focus-visible:border-destructive',
    className,
  );
}

/** Options are shared menu items, which already grow to fit a second line. */
export const comboboxItemClass = cva(menuItemClass, {
  variants: {
    multiple: {
      false: '',
      true: '',
    },
  },
  defaultVariants: {
    multiple: false,
  },
});

export const comboboxStyles = {
  /** Root wrapper */
  root: 'flex flex-col gap-1.5',

  /** Chevron icon in trigger — decorative icon token shared by every field. */
  chevron: 'ml-2 h-4 w-4 shrink-0 text-muted-foreground',

  /** Placeholder text color */
  placeholder: 'text-muted-foreground',

  /**
   * Popup container — shared menu popup, but the search row sits edge-to-edge
   * above the list, so padding/scrolling move to the list itself.
   */
  popup: cn(menuPopupClass, 'max-h-none overflow-hidden p-0'),

  /** Positioner */
  positioner: cn(menuPositionerClass, 'pointer-events-auto'),

  /** Search input container — borderless top section, hairline divider below. */
  searchContainer: menuSearchClasses.container,

  /** Search icon */
  searchIcon: menuSearchClasses.icon,

  /** Search input */
  searchInput: cn(menuSearchClasses.input, 'disabled:cursor-not-allowed disabled:opacity-50'),

  /** Empty state */
  empty: cn(menuEmptyClass, 'empty:hidden'),

  /** Options list */
  // `empty:p-0` — Empty renders outside the List, so an empty List must not leave its padding behind.
  list: 'p-1 empty:p-0',

  /** Scroll container around the List; hosts the fluid highlight so it scrolls with the rows. */
  listScroller: 'max-h-dropdown overflow-y-auto overflow-x-hidden',

  /** Option item base — rounded-lg sits concentrically inside rounded-xl + p-1. */
  item: comboboxItemClass({ multiple: false }),

  /** Multi-select item — same item rhythm with a right-aligned selected check. */
  itemMulti: comboboxItemClass({ multiple: true }),

  /** Right-aligned slot grouping end content + selection check. */
  itemRightSlot: 'ml-auto flex items-center gap-2 shrink-0',

  /** Check indicator container — inline, shown only when item is selected. */
  checkContainer: cn(menuItemCheckClass, 'ml-0'),

  /** Check icon (single select) */
  checkIcon: 'size-full',

  /** Option label/description wrapper */
  optionText: 'flex flex-col gap-0.5 min-w-0',

  /** Option label */
  optionLabel: 'truncate',

  /** Option description */
  optionDescription: 'text-caption text-muted-foreground truncate',

  /** Option end slot — `ml-auto` makes it push right inside flex containers (used by multi-select). */
  optionEnd: 'ml-auto flex items-center shrink-0',

  /** Error message */
  error: 'text-caption text-accent2',
} as const;
