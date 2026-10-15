import { Combobox as BaseCombobox } from '@base-ui/react/combobox';
import { X } from 'lucide-react';
import * as React from 'react';
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
import { Button, isIconButtonSize } from '@/ds/components/Button/Button';
import type { ButtonSize } from '@/ds/components/Button/Button';
import { keepOwnAccessibleName, useFieldAriaIds } from '@/ds/components/Field/field-control-aria';
import { FieldBlock } from '@/ds/components/FormFieldBlocks/block/field-block';
import { fieldErrorId } from '@/ds/components/FormFieldBlocks/block/field-error-id';
import { deprecatedErrorAria } from '@/ds/primitives/form-element';
import type { PortalContainer } from '@/ds/primitives/portal-container';
import { cn } from '@/lib/utils';

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

const EMPTY_VALUES: string[] = [];
const EMPTY_OPTIONS: ComboboxOption[] = [];

function isMultipleCombobox(props: ComboboxProps): props is ComboboxMultipleProps {
  return props.multiple === true;
}

/** The text a field shows for its value: a plain-text `displayLabel` wins over `label`. */
function optionText(option: ComboboxOption) {
  return typeof option.displayLabel === 'string' ? option.displayLabel : option.label;
}

function ComboboxOptionText({ option }: { option: ComboboxOption }) {
  return (
    <span className={comboboxStyles.optionText}>
      <span className={comboboxStyles.optionLabel}>{option.label}</span>
      {option.description && <span className={comboboxStyles.optionDescription}>{option.description}</span>}
    </span>
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
  const {
    options,
    placeholder = isMultipleCombobox(props) ? 'Select options...' : 'Select option...',
    searchPlaceholder = 'Search...',
    emptyText = 'No option found.',
    className,
    disabled = false,
    variant = 'default',
    size = 'md',
    open,
    onOpenChange,
    container,
    id,
    'aria-label': ariaLabel,
    'aria-describedby': ariaDescribedBy,
    align = 'start',
    showChevron = true,
    iconOnlyValue = false,
    allowCustomValue = false,
    onInputValueChange,
    error,
    name,
  } = props;
  const multiple = isMultipleCombobox(props);
  const clearLabel = multiple ? props.clearLabel : undefined;
  const field = useFieldAriaIds();
  const generatedName = React.useId();
  const errorName = name ?? generatedName;
  const describedBy =
    [ariaDescribedBy, error ? fieldErrorId(errorName) : undefined].filter(Boolean).join(' ') || undefined;
  const iconOnly = isIconButtonSize(size);
  const textSize = isIconButtonSize(size) ? undefined : size;
  // A form field (inside a `Field`) searches in itself: a text field for one value, chips for several.
  // Outside one, a Combobox is usually a toolbar or inline picker that callers lay out as a button, so it
  // keeps the trigger with the search in the popup.
  const inField =
    field !== null &&
    variant === 'default' &&
    !isIconButtonSize(size) &&
    // The chips field is tuned to the medium control height.
    (!multiple || size === 'md') &&
    !iconOnlyValue &&
    showChevron &&
    (placeholder === undefined || typeof placeholder === 'string');
  const [inputValue, setInputValue] = React.useState('');
  const customValue = inputValue.trim();
  const selectedOption = multiple ? null : (options.find(option => option.value === props.value) ?? null);
  const customOption =
    !multiple &&
    allowCustomValue &&
    customValue &&
    // A field shows the selected option's text while it's closed; that isn't a new value.
    !options.some(option => option.value === customValue || optionText(option) === customValue)
      ? { label: `Use “${customValue}”`, value: customValue }
      : undefined;
  const displayedOptions = customOption ? [customOption, ...options] : options;
  const selectedValues = multiple ? (props.value ?? EMPTY_VALUES) : EMPTY_VALUES;
  const selectedValueSet = React.useMemo(() => new Set(selectedValues), [selectedValues]);
  const selectedOptions = multiple ? options.filter(option => selectedValueSet.has(option.value)) : EMPTY_OPTIONS;
  const triggerText = selectedOptions.length === 0 ? placeholder : `${selectedOptions.length} selected`;
  const clearSelection = () => {
    if (isMultipleCombobox(props)) props.onValueChange?.([]);
  };
  const { contains } = BaseCombobox.useFilter();
  // Match the label like Base UI's default filter, plus any keywords the option carries.
  const filterOption = React.useCallback(
    (option: ComboboxOption, query: string) =>
      contains(option.label, query) || (option.keywords?.some(keyword => contains(keyword, query)) ?? false),
    [contains],
  );

  const controlProps = {
    id,
    'aria-label': ariaLabel ?? (id || field ? undefined : multiple ? 'Select options' : 'Select option'),
    ...keepOwnAccessibleName({ 'aria-label': ariaLabel }),
    ...deprecatedErrorAria(Boolean(error)),
    'aria-describedby': describedBy,
  };

  const control =
    inField && multiple ? (
      <ComboboxChips className={className}>
        <ComboboxValue>
          {(items: ComboboxOption[]) => (
            <>
              {items.map(item => (
                <ComboboxChip key={item.value}>{item.label}</ComboboxChip>
              ))}
              <ComboboxChipsInput
                {...controlProps}
                placeholder={items.length === 0 ? (placeholder as string | undefined) : undefined}
              />
            </>
          )}
        </ComboboxValue>
      </ComboboxChips>
    ) : inField ? (
      <ComboboxInput
        {...controlProps}
        size={textSize}
        placeholder={placeholder as string | undefined}
        start={selectedOption?.start}
        className={className}
      />
    ) : (
      <ComboboxTrigger
        {...controlProps}
        variant={variant}
        size={size}
        showChevron={showChevron}
        icon={iconOnly ? undefined : selectedOption?.start}
        className={cn(iconOnlyValue && 'w-auto px-2.5', className)}
      >
        {multiple ? (
          iconOnly ? (
            triggerText
          ) : (
            <span className={cn(selectedOptions.length === 0 && comboboxStyles.placeholder)}>{triggerText}</span>
          )
        ) : (
          (selectedOption?.displayLabel ?? <ComboboxValue placeholder={placeholder} />)
        )}
      </ComboboxTrigger>
    );

  const content = (
    <ComboboxContent align={align} container={container}>
      {inField ? null : <ComboboxSearch placeholder={searchPlaceholder} />}
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
      {selectedValues.length > 0 && clearLabel ? (
        <div className="border-t border-border p-1">
          <Button
            type="button"
            variant="destructive-ghost"
            size="sm"
            className="w-full justify-start"
            onClick={clearSelection}
            icon={<X />}
          >
            {clearLabel}
          </Button>
        </div>
      ) : null}
    </ComboboxContent>
  );

  const root = multiple ? (
    <ComboboxRoot
      multiple
      autoHighlight
      items={displayedOptions}
      filter={filterOption}
      value={selectedOptions}
      onValueChange={items => props.onValueChange?.((items ?? []).map(item => item.value))}
      disabled={disabled}
      open={open}
      onOpenChange={onOpenChange}
    >
      {control}
      {content}
    </ComboboxRoot>
  ) : inField ? (
    <ComboboxRoot
      autoHighlight
      items={displayedOptions}
      filter={filterOption}
      itemToStringLabel={optionText}
      value={selectedOption}
      // The field owns its text (the selected option's, or the search); only listen to it.
      onInputValueChange={value => {
        setInputValue(value);
        onInputValueChange?.(value);
      }}
      onValueChange={item => {
        if (item) props.onValueChange?.(item.value);
      }}
      disabled={disabled}
      open={open}
      onOpenChange={onOpenChange}
    >
      {control}
      {content}
    </ComboboxRoot>
  ) : (
    <ComboboxRoot
      autoHighlight
      items={displayedOptions}
      filter={filterOption}
      value={selectedOption}
      inputValue={inputValue}
      onInputValueChange={value => {
        setInputValue(value);
        onInputValueChange?.(value);
      }}
      onValueChange={item => {
        if (item) {
          props.onValueChange?.(item.value);
          setInputValue('');
          onInputValueChange?.('');
        }
      }}
      disabled={disabled}
      open={open}
      onOpenChange={onOpenChange}
    >
      {control}
      {content}
    </ComboboxRoot>
  );

  if (!error) return root;

  return (
    <div className={comboboxStyles.root}>
      {root}
      <FieldBlock.ErrorMsg name={errorName}>{error}</FieldBlock.ErrorMsg>
    </div>
  );
}
