import { Combobox as BaseCombobox } from '@base-ui/react/combobox';
import { X } from 'lucide-react';
import * as React from 'react';
import { cn } from '../../../lib/utils';
import { deprecatedErrorAria } from '../../primitives/form-element';
import type { PortalContainer } from '../../primitives/portal-container';
import { Button, isIconButtonSize } from '../Button/Button';
import type { ButtonSize } from '../Button/Button';
import { keepOwnAccessibleName, useFieldAriaIds } from '../Field/field-control-aria';
import { FieldBlock } from '../FormFieldBlocks/block/field-block';
import { fieldErrorId } from '../FormFieldBlocks/block/field-error-id';
import {
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxRoot,
  ComboboxSearch,
  ComboboxTrigger,
  ComboboxValue,
} from './combobox-parts';
import { comboboxStyles } from './combobox-styles';
import type { ComboboxVariant } from './combobox-styles';

export type { ComboboxVariant } from './combobox-styles';

export type ComboboxOption = {
  label: string;
  value: string;
  description?: string;
  displayLabel?: React.ReactNode;
  start?: React.ReactNode;
  end?: React.ReactNode;
  /** Extra terms the search matches besides `label` (aliases, ids, a provider name). Never displayed. */
  keywords?: readonly string[];
};

type ComboboxSharedProps = {
  options: ComboboxOption[];
  placeholder?: React.ReactNode;
  /** The search row's placeholder for compact triggers. A field (inside a `Field`) searches in itself and shows `placeholder`. */
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  /**
   * `default` inside a `Field` is a form field you type in to search. `ghost` (and the legacy `outline`/`link`),
   * or any variant outside a `Field`, is a compact trigger with the search inside the popup.
   */
  variant?: ComboboxVariant;
  /** Icon sizes (`icon-*`) render a chevron-only trigger with the search in the popup; pass `aria-label` to name it. */
  size?: ButtonSize;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  container?: PortalContainer;
  id?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  /** Which edge of the trigger the popup lines up with. `end` opens it leftwards (e.g. an icon trigger at the end of a row). */
  align?: 'start' | 'center' | 'end';
  showChevron?: boolean;
  iconOnlyValue?: boolean;
  allowCustomValue?: boolean;
  /** Called with the search text as it changes (and with `''` after a compact trigger's selection resets it). */
  onInputValueChange?: (value: string) => void;
  /** @deprecated Wrap the combobox in `<Field invalid>` with a `FieldError`. */
  error?: string;
  /** @deprecated Only keyed the `error` message id; a `Field` links its error without one. */
  name?: string;
};

export type ComboboxSingleProps = ComboboxSharedProps & {
  multiple?: false;
  value?: string;
  onValueChange?: (value: string) => void;
};

export type ComboboxMultipleProps = ComboboxSharedProps & {
  multiple: true;
  value?: readonly string[];
  onValueChange?: (value: string[]) => void;
  clearLabel?: string;
};

export type ComboboxProps = ComboboxSingleProps | ComboboxMultipleProps;

const EMPTY_VALUES: readonly string[] = [];

function isMultipleCombobox(props: ComboboxProps): props is ComboboxMultipleProps {
  return props.multiple === true;
}

/** The text a field shows for its value: a plain-text `displayLabel` wins over `label`. */
function optionText(option: ComboboxOption) {
  return typeof option.displayLabel === 'string' ? option.displayLabel : option.label;
}

/** Inputs take a text placeholder only; a ReactNode placeholder keeps the compact trigger. */
function textPlaceholder(placeholder: React.ReactNode) {
  return typeof placeholder === 'string' ? placeholder : undefined;
}

/**
 * How the combobox renders:
 * - `field`: a single select inside a `Field` searches in the field, like a text input.
 * - `chips`: a multiple select inside a `Field` shows its picks as chips and searches in the field.
 * - `trigger`: everything else (toolbars, breadcrumbs, inline pickers that callers lay out as a button)
 *   keeps a compact trigger with the search inside the popup.
 */
type ComboboxShape = 'field' | 'chips' | 'trigger';

function getComboboxShape({
  inFieldContext,
  multiple,
  variant,
  size,
  iconOnlyValue,
  showChevron,
  placeholder,
}: {
  inFieldContext: boolean;
  multiple: boolean;
  variant: ComboboxVariant;
  size: ButtonSize;
  iconOnlyValue: boolean;
  showChevron: boolean;
  placeholder: React.ReactNode;
}): ComboboxShape {
  if (!inFieldContext) return 'trigger';
  if (variant !== 'default') return 'trigger';
  if (isIconButtonSize(size)) return 'trigger';
  if (iconOnlyValue || !showChevron) return 'trigger';
  if (placeholder !== undefined && textPlaceholder(placeholder) === undefined) return 'trigger';
  if (!multiple) return 'field';
  // The chips field is tuned to the medium control height.
  if (size !== 'md') return 'trigger';
  return 'chips';
}

/** A "Use “text”" option for typed text that isn't one of the options yet. */
function getCustomOption(options: ComboboxOption[], inputValue: string): ComboboxOption | undefined {
  const value = inputValue.trim();
  if (!value) return undefined;
  // A field shows the selected option's text while it's closed; that isn't a new value.
  if (options.some(option => option.value === value || optionText(option) === value)) return undefined;
  return { label: `Use “${value}”`, value };
}

/** Matches the label like Base UI's default filter, the text a field shows, and any keywords. */
function useOptionFilter() {
  const { contains } = BaseCombobox.useFilter();
  return (option: ComboboxOption, query: string) =>
    [option.label, optionText(option), ...(option.keywords ?? [])].some(text => contains(text, query));
}

/** Names the control when nothing else does: an `id` or a `Field` links a label to it instead. */
function getFallbackAriaLabel({ hasLabel, multiple }: { hasLabel: boolean; multiple: boolean }) {
  if (hasLabel) return undefined;
  return multiple ? 'Select options' : 'Select option';
}

function getControlProps({
  id,
  ariaLabel,
  ariaDescribedBy,
  hasLabel,
  multiple,
  error,
  errorName,
}: {
  id?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  hasLabel: boolean;
  multiple: boolean;
  error?: string;
  errorName: string;
}) {
  const describedBy = [ariaDescribedBy, error ? fieldErrorId(errorName) : undefined].filter(Boolean).join(' ');
  return {
    id,
    'aria-label': ariaLabel ?? getFallbackAriaLabel({ hasLabel, multiple }),
    ...keepOwnAccessibleName({ 'aria-label': ariaLabel }),
    ...deprecatedErrorAria(Boolean(error)),
    'aria-describedby': describedBy || undefined,
  };
}

type ControlProps = ReturnType<typeof getControlProps>;

function triggerClassName({ iconOnlyValue, className }: { iconOnlyValue: boolean; className?: string }) {
  return cn(iconOnlyValue && 'w-auto px-2.5', className);
}

function ComboboxOptionText({ option }: { option: ComboboxOption }) {
  return (
    <span className={comboboxStyles.optionText}>
      <span className={comboboxStyles.optionLabel}>{option.label}</span>
      {option.description && <span className={comboboxStyles.optionDescription}>{option.description}</span>}
    </span>
  );
}

function ComboboxClearFooter({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <div className="border-t border-border p-1">
      <Button
        type="button"
        variant="destructive-ghost"
        size="sm"
        className="w-full justify-start"
        onClick={onClear}
        icon={<X />}
      >
        {label}
      </Button>
    </div>
  );
}

/** The popup: the search row for a compact trigger (a field searches in itself), then the options. */
function ComboboxOptionsContent({
  showSearch,
  searchPlaceholder,
  emptyText,
  align,
  container,
  footer,
}: {
  showSearch: boolean;
  searchPlaceholder: string;
  emptyText: string;
  align: 'start' | 'center' | 'end';
  container?: PortalContainer;
  footer?: React.ReactNode;
}) {
  return (
    <ComboboxContent align={align} container={container}>
      {showSearch ? <ComboboxSearch placeholder={searchPlaceholder} /> : null}
      <ComboboxEmpty>{emptyText}</ComboboxEmpty>
      <ComboboxList>
        {(option: ComboboxOption) => (
          <ComboboxItem key={option.value} value={option}>
            {option.start}
            <ComboboxOptionText option={option} />
            {option.end ? <span className={comboboxStyles.optionEnd}>{option.end}</span> : null}
          </ComboboxItem>
        )}
      </ComboboxList>
      {footer}
    </ComboboxContent>
  );
}

type TriggerLookProps = {
  variant: ComboboxVariant;
  size: ButtonSize;
  showChevron: boolean;
  iconOnlyValue: boolean;
  className?: string;
};

function SingleComboboxControl({
  shape,
  controlProps,
  placeholder,
  selectedOption,
  look,
}: {
  shape: ComboboxShape;
  controlProps: ControlProps;
  placeholder: React.ReactNode;
  selectedOption?: ComboboxOption;
  look: TriggerLookProps;
}) {
  if (shape === 'field') {
    return (
      <ComboboxInput
        {...controlProps}
        size={isIconButtonSize(look.size) ? undefined : look.size}
        placeholder={textPlaceholder(placeholder)}
        start={selectedOption?.start}
        className={look.className}
      />
    );
  }

  return (
    <ComboboxTrigger
      {...controlProps}
      variant={look.variant}
      size={look.size}
      showChevron={look.showChevron}
      icon={isIconButtonSize(look.size) ? undefined : selectedOption?.start}
      className={triggerClassName(look)}
    >
      {selectedOption?.displayLabel ?? <ComboboxValue placeholder={placeholder} />}
    </ComboboxTrigger>
  );
}

function MultipleComboboxControl({
  shape,
  controlProps,
  placeholder,
  selectedCount,
  look,
}: {
  shape: ComboboxShape;
  controlProps: ControlProps;
  placeholder: React.ReactNode;
  selectedCount: number;
  look: TriggerLookProps;
}) {
  if (shape === 'chips') {
    return (
      <ComboboxChips className={look.className}>
        <ComboboxValue>
          {(items: ComboboxOption[]) => (
            <>
              {items.map(item => (
                <ComboboxChip key={item.value}>{item.label}</ComboboxChip>
              ))}
              <ComboboxChipsInput
                {...controlProps}
                placeholder={items.length === 0 ? textPlaceholder(placeholder) : undefined}
              />
            </>
          )}
        </ComboboxValue>
      </ComboboxChips>
    );
  }

  const text = selectedCount === 0 ? placeholder : `${selectedCount} selected`;
  return (
    <ComboboxTrigger
      {...controlProps}
      variant={look.variant}
      size={look.size}
      showChevron={look.showChevron}
      className={triggerClassName(look)}
    >
      <span className={cn(selectedCount === 0 && comboboxStyles.placeholder)}>{text}</span>
    </ComboboxTrigger>
  );
}

type ShapeProps = { shape: ComboboxShape; controlProps: ControlProps };

function SingleCombobox({
  shape,
  controlProps,
  options,
  value,
  onValueChange,
  placeholder = 'Select option...',
  searchPlaceholder = 'Search...',
  emptyText = 'No option found.',
  className,
  disabled = false,
  variant = 'default',
  size = 'md',
  open,
  onOpenChange,
  container,
  align = 'start',
  showChevron = true,
  iconOnlyValue = false,
  allowCustomValue = false,
  onInputValueChange,
}: ComboboxSingleProps & ShapeProps) {
  // The search text: a field's own text, or the compact trigger's popup search.
  const [inputValue, setInputValue] = React.useState('');
  const filter = useOptionFilter();
  const inField = shape === 'field';
  const selectedOption = options.find(option => option.value === value);
  const customOption = allowCustomValue ? getCustomOption(options, inputValue) : undefined;
  const items = customOption ? [customOption, ...options] : options;

  function handleInputValueChange(next: string) {
    setInputValue(next);
    onInputValueChange?.(next);
  }

  function handleValueChange(item: ComboboxOption | null) {
    if (!item) return;
    onValueChange?.(item.value);
    // A field shows the picked option; a compact trigger's popup search starts empty next time.
    if (!inField) handleInputValueChange('');
  }

  return (
    <ComboboxRoot
      autoHighlight
      items={items}
      filter={filter}
      itemToStringLabel={optionText}
      // Base UI's "nothing selected" is null.
      value={selectedOption ?? null}
      // A field owns its text (the selected option's, or the search); a compact trigger's search is reset here.
      inputValue={inField ? undefined : inputValue}
      onInputValueChange={handleInputValueChange}
      onValueChange={handleValueChange}
      disabled={disabled}
      open={open}
      onOpenChange={onOpenChange}
    >
      <SingleComboboxControl
        shape={shape}
        controlProps={controlProps}
        placeholder={placeholder}
        selectedOption={selectedOption}
        look={{ variant, size, showChevron, iconOnlyValue, className }}
      />
      <ComboboxOptionsContent
        showSearch={!inField}
        searchPlaceholder={searchPlaceholder}
        emptyText={emptyText}
        align={align}
        container={container}
      />
    </ComboboxRoot>
  );
}

function MultipleCombobox({
  shape,
  controlProps,
  options,
  value = EMPTY_VALUES,
  onValueChange,
  clearLabel,
  placeholder = 'Select options...',
  searchPlaceholder = 'Search...',
  emptyText = 'No option found.',
  className,
  disabled = false,
  variant = 'default',
  size = 'md',
  open,
  onOpenChange,
  container,
  align = 'start',
  showChevron = true,
  iconOnlyValue = false,
}: ComboboxMultipleProps & ShapeProps) {
  const filter = useOptionFilter();
  const selectedValues = new Set(value);
  const selectedOptions = options.filter(option => selectedValues.has(option.value));
  const footer =
    clearLabel && selectedOptions.length > 0 ? (
      <ComboboxClearFooter label={clearLabel} onClear={() => onValueChange?.([])} />
    ) : undefined;

  return (
    <ComboboxRoot
      multiple
      autoHighlight
      items={options}
      filter={filter}
      value={selectedOptions}
      onValueChange={items => onValueChange?.(items.map(item => item.value))}
      disabled={disabled}
      open={open}
      onOpenChange={onOpenChange}
    >
      <MultipleComboboxControl
        shape={shape}
        controlProps={controlProps}
        placeholder={placeholder}
        selectedCount={selectedOptions.length}
        look={{ variant, size, showChevron, iconOnlyValue, className }}
      />
      <ComboboxOptionsContent
        showSearch={shape !== 'chips'}
        searchPlaceholder={searchPlaceholder}
        emptyText={emptyText}
        align={align}
        container={container}
        footer={footer}
      />
    </ComboboxRoot>
  );
}

/**
 * A searchable select driven by `options`, built on the Combobox parts.
 *
 * Inside a `Field`, a `default` combobox searches right in the field: a text field for a single value,
 * removable chips for `multiple`. Everywhere else (outside a `Field`, `ghost` and icon-size triggers,
 * custom non-text placeholders) it keeps a compact trigger with the search inside the popup. For anything
 * these props don't cover (groups, rich items), compose the parts directly (`ComboboxRoot`, ...).
 */
export function Combobox(props: ComboboxProps) {
  const field = useFieldAriaIds();
  const generatedName = React.useId();
  const multiple = isMultipleCombobox(props);
  const shape = getComboboxShape({
    inFieldContext: Boolean(field),
    multiple,
    variant: props.variant ?? 'default',
    size: props.size ?? 'md',
    iconOnlyValue: props.iconOnlyValue ?? false,
    showChevron: props.showChevron ?? true,
    placeholder: props.placeholder,
  });
  const errorName = props.name ?? generatedName;
  const controlProps = getControlProps({
    id: props.id,
    ariaLabel: props['aria-label'],
    ariaDescribedBy: props['aria-describedby'],
    hasLabel: Boolean(props.id || field),
    multiple,
    error: props.error,
    errorName,
  });

  const root = isMultipleCombobox(props) ? (
    <MultipleCombobox {...props} shape={shape} controlProps={controlProps} />
  ) : (
    <SingleCombobox {...props} shape={shape} controlProps={controlProps} />
  );

  if (!props.error) return root;

  return (
    <div className={comboboxStyles.root}>
      {root}
      <FieldBlock.ErrorMsg name={errorName}>{props.error}</FieldBlock.ErrorMsg>
    </div>
  );
}
