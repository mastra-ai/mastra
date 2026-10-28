// Composable Combobox parts: shadcn's structure and names (https://ui.shadcn.com/docs/components/combobox),
// built on Base UI like theirs, styled with our design system. The root is `ComboboxRoot` because
// `Combobox` is the options-driven component in combobox.tsx.
import { Combobox as BaseCombobox } from '@base-ui/react/combobox';
import { Check, ChevronDown, ChevronsUpDown, Search, X } from 'lucide-react';
import * as React from 'react';
import { comboboxItemClass, comboboxStyles, comboboxTriggerClass } from './combobox-styles';
import type { ComboboxVariant } from './combobox-styles';
import { isIconButtonSize } from '@/ds/components/Button/Button';
import type { ButtonSize, TextButtonSize } from '@/ds/components/Button/Button';
import { ScrollArea, ScrollAreaViewport } from '@/ds/components/ScrollArea';
import { FLOATING_POSITION_METHOD } from '@/ds/primitives/floating';
import { menuLabelClass, menuSeparatorClass } from '@/ds/primitives/menu-item';
import { passwordManagerOptOutProps } from '@/ds/primitives/password-manager-autofill';
import { usePopupAnchor } from '@/ds/primitives/popup-anchor';
import { usePortalContainer } from '@/ds/primitives/portal-container';
import type { PortalContainer } from '@/ds/primitives/portal-container';
import { cn } from '@/lib/utils';

/**
 * Root. Same props as Base UI's `Combobox.Root` (`items`, `value`, `onValueChange`, `multiple`,
 * `autoHighlight`, `filter`, ...). Pick one of three shapes:
 * - Search in the field: `ComboboxInput` + `ComboboxContent`.
 * - Multiple, chips in the field: `ComboboxChips` (chips + `ComboboxChipsInput`) + `ComboboxContent`.
 * - Compact trigger, search in the popup: `ComboboxTrigger` + `ComboboxContent` starting with
 *   `ComboboxSearch`. For small triggers (an icon, a ghost button in a toolbar).
 */
function ComboboxRoot<Value, Multiple extends boolean | undefined = false>(
  props: BaseCombobox.Root.Props<Value, Multiple>,
) {
  return <BaseCombobox.Root {...props} />;
}

/**
 * The field surface: today's trigger look, focus shown while the input inside has focus. The
 * chevron ends every field, at the same padding as today's Combobox trigger.
 */
const fieldClass = (size: TextButtonSize = 'md') =>
  cn(
    comboboxTriggerClass({ variant: 'default', size }),
    // The Button recipe brightens icons on hover; a field's chevron stays muted.
    'cursor-text gap-2 focus-within:[--surface-rim:var(--field-rim-focus)] not-disabled:hover:[&_svg]:text-muted-foreground',
    // Disabled like other form elements (muted text, not-allowed cursor), keyed off the input.
    'has-[input:disabled]:cursor-not-allowed has-[input:disabled]:bg-field-disabled has-[input:disabled]:[&_*]:cursor-not-allowed has-[input:disabled]:[&_*]:text-muted-foreground',
    // The input inside carries `aria-invalid`; the field shows it like other invalid fields.
    'has-[[aria-invalid=true]]:[--field-rim-focus:var(--destructive-indicator)] has-[[aria-invalid=true]]:[--field-rim:var(--destructive-indicator)]',
  );

/**
 * Text starts 0.9em in (the Button recipe's padding, shared with Select and today's Combobox).
 * The chevron is a 22px circle; its arrow's ink sits 6.33px inside the circle's edge (3px circle
 * inset + 3.33px icon inset), so the end padding puts that ink 0.9em from the end, like the text.
 */
const fieldPx = '0.9em';

/** Inline so it wins over the Button recipe's `px` (same layer, later in the sheet). */
const fieldStyle: React.CSSProperties = {
  paddingInlineStart: fieldPx,
  paddingInlineEnd: `calc(${fieldPx} - 6.33px)`,
};

/**
 * Chips sit 4px from the field's edge on top, bottom and left: 3px visible inside the 1px rim,
 * the same 3px as the gap between chips. A chip is the field height minus that padding (22px).
 */
const chipsFieldStyle: React.CSSProperties = {
  // Longhands only: a `padding` shorthand here would also reset the chevron's end padding.
  paddingBlock: '4px',
  paddingInlineStart: '4px',
  paddingInlineEnd: fieldStyle.paddingInlineEnd,
};

// `w-0` + `flex-1`: an input's default width (about 20 characters) would otherwise set the field's
// minimum width, so it couldn't shrink into a narrow column.
const inputClass =
  'h-full w-0 min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground';

/** Caret at the end of the value instead of selecting it, the way a text field behaves. */
function moveCaretToEnd(event: React.FocusEvent<HTMLInputElement>) {
  const input = event.currentTarget;
  // Deferred one frame so it runs after the click places the caret; clicking the label lands here too.
  requestAnimationFrame(() => input.setSelectionRange(input.value.length, input.value.length));
}

/**
 * The selected value, for a compact `ComboboxTrigger` or a custom display. `children` can be a
 * function of the value; `placeholder` shows while nothing is selected.
 */
function ComboboxValue(props: BaseCombobox.Value.Props) {
  return <BaseCombobox.Value data-slot="combobox-value" {...props} />;
}

/** The round chevron button that ends ComboboxInput and ComboboxChips. */
function ComboboxFieldTrigger() {
  return (
    <BaseCombobox.Trigger
      data-slot="combobox-field-trigger"
      aria-label="Show options"
      // A round button target: the circle fills on hover, the chevron keeps its color.
      className="flex size-5.5 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground not-data-disabled:hover:bg-fill"
    >
      {/* Sized like Select's chevron: outside the icon rung, so it keeps Lucide's default stroke
          (1.33px at 16px) instead of the rung's 1px. */}
      <ChevronDown className="size-4" />
    </BaseCombobox.Trigger>
  );
}

type ComboboxTriggerProps = Omit<BaseCombobox.Trigger.Props, 'className'> & {
  className?: string;
  /** The Button-recipe look, like Select: `default` (field surface), `outline` or `ghost`. */
  variant?: ComboboxVariant;
  /** Icon sizes (`icon-*`) show only `icon` (or the chevron); `children` stay as accessible text. */
  size?: ButtonSize;
  /** Shown before the value, or alone at icon sizes (e.g. a filter icon), replacing the chevron there. */
  icon?: React.ReactNode;
  showChevron?: boolean;
};

/**
 * A compact trigger that opens the list, with the search inside the popup (`ComboboxSearch`). For
 * small triggers such as an icon or a ghost button; a form field uses ComboboxInput instead.
 * `children` is what the trigger shows, usually `<ComboboxValue placeholder="…" />`.
 */
function ComboboxTrigger({
  className,
  children,
  variant = 'default',
  size = 'md',
  icon,
  showChevron = !(icon && isIconButtonSize(size)),
  ...props
}: ComboboxTriggerProps) {
  const iconOnly = isIconButtonSize(size);
  return (
    <BaseCombobox.Trigger
      data-slot="combobox-trigger"
      data-shape={iconOnly ? 'icon' : undefined}
      className={comboboxTriggerClass({ variant, size, className })}
      {...props}
    >
      {iconOnly ? (
        <>
          {icon}
          <span className="sr-only">{children}</span>
        </>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {icon}
          <span className="truncate">{children}</span>
        </span>
      )}
      {/* Wrapped so the svg escapes Button's `[&>svg]` adornments, like today's Combobox chevron. */}
      {showChevron ? (
        <span className="flex shrink-0 items-center">
          <ChevronsUpDown className={cn(comboboxStyles.chevron, iconOnly && 'ml-0')} />
        </span>
      ) : null}
    </BaseCombobox.Trigger>
  );
}

/** An × that clears the value. ComboboxInput renders it with `showClear`. */
function ComboboxClear({ className, ...props }: BaseCombobox.Clear.Props) {
  return (
    <BaseCombobox.Clear
      data-slot="combobox-clear"
      aria-label="Clear"
      className={cn(
        'flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground',
        className,
      )}
      {...props}
    >
      <X className="size-3.5" />
    </BaseCombobox.Clear>
  );
}

type ComboboxInputProps = Omit<BaseCombobox.Input.Props, 'size'> & {
  /** The field height, from the control sizes. `md` by default. */
  size?: TextButtonSize;
  /** Shown before the text, e.g. the selected item's icon. */
  start?: React.ReactNode;
  /** The chevron button at the end. On by default. */
  showTrigger?: boolean;
  /** An × before the chevron that clears the value. */
  showClear?: boolean;
};

/**
 * The field you type in to filter, showing the selected value while it's closed. `children` render
 * inside the field before the chevron (e.g. a muted "4 items" detail). The list opens at the
 * field's width. Inside a `Field`, the label and errors link to it.
 */
function ComboboxInput({
  className,
  children,
  showTrigger = true,
  showClear = false,
  size,
  start,
  onFocus,
  ...props
}: ComboboxInputProps) {
  return (
    <BaseCombobox.InputGroup data-slot="combobox-input" className={cn(fieldClass(size), className)} style={fieldStyle}>
      {start ? <span className="flex shrink-0 items-center">{start}</span> : null}
      <BaseCombobox.Input
        onFocus={event => {
          moveCaretToEnd(event);
          onFocus?.(event);
        }}
        className={inputClass}
        {...passwordManagerOptOutProps}
        {...props}
      />
      {children ? <span className="flex shrink-0 items-center gap-2 text-muted-foreground">{children}</span> : null}
      {showClear ? <ComboboxClear /> : null}
      {showTrigger ? <ComboboxFieldTrigger /> : null}
    </BaseCombobox.InputGroup>
  );
}

/**
 * The search row at the top of the popup, for a compact `ComboboxTrigger`. The same row as today's
 * Combobox: a search icon, a borderless input and a hairline under it.
 */
function ComboboxSearch({ className, ...props }: BaseCombobox.Input.Props) {
  return (
    <div data-slot="combobox-search" className={comboboxStyles.searchContainer}>
      <Search className={comboboxStyles.searchIcon} />
      <BaseCombobox.Input
        className={cn(comboboxStyles.searchInput, className)}
        {...passwordManagerOptOutProps}
        {...props}
      />
    </div>
  );
}

type ComboboxContentProps = BaseCombobox.Popup.Props &
  Pick<BaseCombobox.Positioner.Props, 'side' | 'align' | 'sideOffset' | 'alignOffset' | 'anchor'> & {
    /** Where the popup portals to. Defaults to the nearest dialog or drawer, so it stays interactive there. */
    container?: PortalContainer;
  };

/**
 * The popup. Under a field (ComboboxInput or ComboboxChips) it opens at the field's width; under a
 * compact ComboboxTrigger it takes the trigger's width, at least 11rem. Either way the width never
 * follows the filtered items, so it holds still while you type; long labels truncate.
 */
function ComboboxContent({
  className,
  side = 'bottom',
  sideOffset = 4,
  align = 'start',
  alignOffset = 0,
  anchor,
  container,
  ...props
}: ComboboxContentProps) {
  const popupAnchor = usePopupAnchor();
  const resolvedContainer = usePortalContainer(container);
  return (
    <BaseCombobox.Portal container={resolvedContainer}>
      <BaseCombobox.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        // Base UI anchors to the field (the InputGroup of ComboboxInput or ComboboxChips), or to the
        // trigger when the input is in the popup; a crumb switcher anchors to the whole crumb.
        anchor={anchor ?? popupAnchor}
        positionMethod={FLOATING_POSITION_METHOD}
        className={comboboxStyles.positioner}
      >
        <BaseCombobox.Popup
          data-slot="combobox-content"
          // With the popup's `min-w-[max(11rem,var(--anchor-width))]`: the anchor's width, at least 11rem.
          className={cn(comboboxStyles.popup, 'w-(--anchor-width)', className)}
          {...props}
        />
      </BaseCombobox.Positioner>
    </BaseCombobox.Portal>
  );
}

/** The scrolling list. Children: a render function per item (or per group), like Base UI's List. */
function ComboboxList({ className, ...props }: BaseCombobox.List.Props) {
  return (
    <ScrollArea maxHeight="var(--spacing-dropdown)">
      <ScrollAreaViewport className="scroll-py-8">
        <BaseCombobox.List data-slot="combobox-list" className={cn(comboboxStyles.list, className)} {...props} />
      </ScrollAreaViewport>
    </ScrollArea>
  );
}

/** One option. A check shows on the right while it's selected. */
function ComboboxItem({ className, children, ref, ...props }: BaseCombobox.Item.Props) {
  return (
    <BaseCombobox.Item ref={ref} data-slot="combobox-item" className={cn(comboboxItemClass({}), className)} {...props}>
      <span className="flex min-w-0 flex-1 items-center gap-2">{children}</span>
      <span className={comboboxStyles.checkContainer}>
        <BaseCombobox.ItemIndicator>
          <Check className={comboboxStyles.checkIcon} />
        </BaseCombobox.ItemIndicator>
      </span>
    </BaseCombobox.Item>
  );
}

/** Title over a description inside an item (shadcn's Item / ItemTitle / ItemDescription). */
function ComboboxItemContent({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span data-slot="combobox-item-content" className={cn('flex min-w-0 flex-col gap-0.5', className)} {...props} />
  );
}

function ComboboxItemTitle({ className, ...props }: React.ComponentProps<'span'>) {
  return <span data-slot="combobox-item-title" className={cn('truncate', className)} {...props} />;
}

/** Muted, up to two lines. */
function ComboboxItemDescription({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="combobox-item-description"
      // `whitespace-normal`: the item recipe's `[&>span]:truncate` makes its content `nowrap`, which
      // would cut the description off mid-word on one line instead of clamping it at two.
      className={cn('line-clamp-2 text-caption whitespace-normal text-muted-foreground', className)}
      {...props}
    />
  );
}

/** Muted text at the end of an item, e.g. its kind ("Agent"). */
function ComboboxItemEnd({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="combobox-item-end"
      className={cn('ml-auto shrink-0 text-caption text-muted-foreground', className)}
      {...props}
    />
  );
}

/** A section of items. Pass the section's `items`; render them with ComboboxCollection. */
function ComboboxGroup(props: BaseCombobox.Group.Props) {
  return <BaseCombobox.Group data-slot="combobox-group" {...props} />;
}

/** A group's heading, styled like menu section labels. */
function ComboboxLabel({ className, ...props }: BaseCombobox.GroupLabel.Props) {
  return <BaseCombobox.GroupLabel data-slot="combobox-label" className={cn(menuLabelClass, className)} {...props} />;
}

/** Renders a group's filtered items, one render function call per item. */
function ComboboxCollection(props: BaseCombobox.Collection.Props) {
  return <BaseCombobox.Collection data-slot="combobox-collection" {...props} />;
}

/** Shows its children only when the filter matches nothing. */
function ComboboxEmpty({ className, ...props }: BaseCombobox.Empty.Props) {
  return <BaseCombobox.Empty data-slot="combobox-empty" className={cn(comboboxStyles.empty, className)} {...props} />;
}

function ComboboxSeparator({ className, ...props }: BaseCombobox.Separator.Props) {
  return (
    <BaseCombobox.Separator data-slot="combobox-separator" className={cn(menuSeparatorClass, className)} {...props} />
  );
}

/**
 * Multi-select field: chips for the picked items, then ComboboxChipsInput. The chips and input wrap
 * inside their own area so the chevron keeps its place on the first row. While the field is one
 * line it keeps the pill shape of every other field; once chips wrap it takes the Textarea corner.
 */
function ComboboxChips({ className, children, 'aria-label': ariaLabel, ...props }: BaseCombobox.InputGroup.Props) {
  // On the inner chips area, so a caller's `ref` reaches the field without merging refs.
  const chipsRef = React.useRef<HTMLDivElement>(null);
  const [multiline, setMultiline] = React.useState(false);

  React.useLayoutEffect(() => {
    const field = chipsRef.current?.parentElement;
    // No observer (e.g. jsdom in tests): the field keeps its one-row shape.
    if (!field || typeof ResizeObserver === 'undefined') return;
    // One row is the control height (the field's `min-height`); anything taller means the chips wrapped.
    // The 1px slack absorbs subpixel rounding.
    const rowHeight = parseFloat(getComputedStyle(field).minHeight) || 0;
    const observer = new ResizeObserver(() => setMultiline(field.offsetHeight > rowHeight + 1));
    observer.observe(field);
    return () => observer.disconnect();
  }, []);

  // Chips inside an InputGroup, like Base UI's multi-select example: the popup anchors to the group.
  return (
    <BaseCombobox.InputGroup
      data-slot="combobox-chips"
      data-multiline={multiline ? '' : undefined}
      style={chipsFieldStyle}
      className={cn(
        fieldClass(),
        'h-auto min-h-control-md items-start data-multiline:rounded-xl',
        // The chips field keeps its resting look: no open tint, no placeholder color. InputGroup sets those
        // attributes, which the trigger recipe styles.
        'data-[placeholder]:text-foreground data-[popup-open]:[--surface-tint:transparent]',
        className,
      )}
      {...props}
    >
      {/* The label names the chips toolbar, as it did when Chips was the outer element. */}
      <BaseCombobox.Chips ref={chipsRef} aria-label={ariaLabel} className="flex min-w-0 flex-1 flex-wrap gap-[3px]">
        {children}
      </BaseCombobox.Chips>
      {/* Same height as a chip, so the chevron centers on the first row. */}
      <span className="flex h-5.5 shrink-0 items-center">
        <ComboboxFieldTrigger />
      </span>
    </BaseCombobox.InputGroup>
  );
}

/** One picked item inside ComboboxChips. The × (or Backspace in the input) removes it. */
function ComboboxChip({
  className,
  children,
  showRemove = true,
  ...props
}: BaseCombobox.Chip.Props & { showRemove?: boolean }) {
  return (
    <BaseCombobox.Chip
      data-slot="combobox-chip"
      className={cn(
        // 8px from the left edge to the text, 6px from the text to the ×'s ink, 8px from the ink to
        // the right edge. Text in the controls' role (`text-label`), like the field value.
        'flex h-5.5 items-center rounded-full bg-fill pl-2 text-label text-foreground',
        !showRemove && 'pr-2',
        className,
      )}
      {...props}
    >
      {children}
      {showRemove ? (
        <BaseCombobox.ChipRemove
          data-slot="combobox-chip-remove"
          aria-label={typeof children === 'string' ? `Remove ${children}` : 'Remove'}
          // The whole right end is the hit area: full height, from the gap to the chip's edge. The ×'s
          // ink sits 2.5px inside its 12px icon, so 3.5px / 5.5px padding put it 6px / 8px out.
          className="flex h-full cursor-pointer items-center rounded-r-full pr-[5.5px] pl-[3.5px] text-muted-foreground not-data-disabled:hover:text-foreground"
        >
          {/* Inline so the button's color wins over the field's `[&_svg]` icon colors. */}
          <X className="size-3" style={{ color: 'inherit' }} />
        </BaseCombobox.ChipRemove>
      ) : null}
    </BaseCombobox.Chip>
  );
}

/** The text input after the chips in ComboboxChips. */
function ComboboxChipsInput({ className, onFocus, ...props }: BaseCombobox.Input.Props) {
  return (
    <BaseCombobox.Input
      data-slot="combobox-chip-input"
      onFocus={event => {
        moveCaretToEnd(event);
        onFocus?.(event);
      }}
      className={cn(
        inputClass,
        // Text lines up with other fields' text when there are no chips; 4px after a chip otherwise.
        // Not `first:`: Base UI inserts a hidden Dismiss element before the input while open.
        'h-5.5 w-0 min-w-12 flex-1 pl-[calc(0.9em_-_4px)] [[data-slot=combobox-chip]~&]:pl-1',
        className,
      )}
      {...passwordManagerOptOutProps}
      {...props}
    />
  );
}

export type { ComboboxTriggerProps, ComboboxInputProps, ComboboxContentProps };

export {
  ComboboxRoot,
  ComboboxInput,
  ComboboxTrigger,
  ComboboxSearch,
  ComboboxValue,
  ComboboxClear,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxItemContent,
  ComboboxItemTitle,
  ComboboxItemDescription,
  ComboboxItemEnd,
  ComboboxGroup,
  ComboboxLabel,
  ComboboxCollection,
  ComboboxEmpty,
  ComboboxSeparator,
  ComboboxChips,
  ComboboxChip,
  ComboboxChipsInput,
};
