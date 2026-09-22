import { Combobox as BaseCombobox } from '@base-ui/react/combobox';
import { Check, ChevronsUpDown, Search, X } from 'lucide-react';
import * as React from 'react';
import { comboboxItemClass, comboboxStyles, comboboxTriggerClass } from './combobox-styles';
import type { ComboboxVariant } from './combobox-styles';
import { Button, isIconButtonSize } from '@/ds/components/Button/Button';
import type { ButtonSize } from '@/ds/components/Button/Button';
import { FieldBlock } from '@/ds/components/FormFieldBlocks/block/field-block';
import { fieldErrorId } from '@/ds/components/FormFieldBlocks/block/field-error-id';
import { FLOATING_POSITION_METHOD } from '@/ds/primitives/floating';
import { FluidMenuItems, useFluidMenu, useFluidMenuItemRef } from '@/ds/primitives/fluid-menu';
import { usePortalContainer } from '@/ds/primitives/portal-container';
import { cn } from '@/lib/utils';

export type { ComboboxVariant } from './combobox-styles';

export type ComboboxOption = {
  label: string;
  value: string;
  description?: string;
  start?: React.ReactNode;
  end?: React.ReactNode;
};

type ComboboxSharedProps = {
  options: ComboboxOption[];
  placeholder?: React.ReactNode;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  variant?: ComboboxVariant;
  /** Icon sizes (`icon-*`) render a chevron-only trigger; pass `aria-label` to name it. */
  size?: ButtonSize;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  container?: HTMLElement | ShadowRoot | null | React.RefObject<HTMLElement | ShadowRoot | null>;
  error?: string;
  id?: string;
  name?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  /** Which edge of the trigger the popup lines up with. `end` opens it leftwards (e.g. an icon trigger at the end of a row). */
  align?: 'start' | 'center' | 'end';
  allowCustomValue?: boolean;
  /** Called with the search input text as it changes (and with `''` after a single-mode selection resets it). */
  onInputValueChange?: (value: string) => void;
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

const ComboboxItem = React.forwardRef<HTMLDivElement, BaseCombobox.Item.Props>((props, ref) => (
  <BaseCombobox.Item ref={useFluidMenuItemRef(ref)} {...props} />
));
ComboboxItem.displayName = 'ComboboxItem';

function ComboboxOptionText({ option }: { option: ComboboxOption }) {
  return (
    <span className={comboboxStyles.optionText}>
      <span className={comboboxStyles.optionLabel}>{option.label}</span>
      {option.description && <span className={comboboxStyles.optionDescription}>{option.description}</span>}
    </span>
  );
}

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
    error,
    id,
    name,
    'aria-label': ariaLabel,
    'aria-describedby': ariaDescribedBy,
    align = 'start',
    allowCustomValue = false,
    onInputValueChange,
  } = props;
  const multiple = isMultipleCombobox(props);
  const clearLabel = multiple ? props.clearLabel : undefined;
  const generatedName = React.useId();
  const errorName = name ?? generatedName;
  const describedBy =
    [ariaDescribedBy, error ? fieldErrorId(errorName) : undefined].filter(Boolean).join(' ') || undefined;
  const [inputValue, setInputValue] = React.useState('');
  const customValue = inputValue.trim();
  const customOption =
    !multiple && allowCustomValue && customValue && !options.some(option => option.value === customValue)
      ? { label: `Use “${customValue}”`, value: customValue }
      : undefined;
  const displayedOptions = customOption ? [customOption, ...options] : options;
  const selectedValues = multiple ? (props.value ?? EMPTY_VALUES) : EMPTY_VALUES;
  const selectedValueSet = React.useMemo(() => new Set(selectedValues), [selectedValues]);
  const selectedOption = multiple ? null : (options.find(option => option.value === props.value) ?? null);
  const selectedOptions = multiple ? options.filter(option => selectedValueSet.has(option.value)) : EMPTY_OPTIONS;
  const triggerText = selectedOptions.length === 0 ? placeholder : `${selectedOptions.length} selected`;
  const clearSelection = () => {
    if (isMultipleCombobox(props)) props.onValueChange?.([]);
  };
  // Default to the nearest SideDialog/Drawer popup so the list stays
  // interactive inside a modal drawer; an explicit `container` still wins.
  const resolvedContainer = usePortalContainer(container);
  const menu = useFluidMenu<HTMLDivElement>();
  const iconOnly = isIconButtonSize(size);

  const comboboxContent = (
    <>
      <BaseCombobox.Trigger
        id={id}
        aria-label={ariaLabel ?? (id ? undefined : multiple ? 'Select options' : 'Select option')}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={comboboxTriggerClass({ variant, size, error: Boolean(error), className })}
      >
        {iconOnly ? (
          <span className="sr-only">{multiple ? triggerText : <BaseCombobox.Value placeholder={placeholder} />}</span>
        ) : multiple ? (
          <span className={cn('truncate', selectedOptions.length === 0 && comboboxStyles.placeholder)}>
            {triggerText}
          </span>
        ) : (
          // Keep truncation off the outer wrapper so start adornments are not clipped.
          <span className="flex min-w-0 flex-1 items-center gap-2">
            {selectedOption?.start}
            <span className="truncate">
              <BaseCombobox.Value placeholder={placeholder} />
            </span>
          </span>
        )}
        {/* Wrap the chevron in a `<span>` so the svg is one level deep and
            escapes Button's `[&>svg]` adornments — mirrors Select's chevron wrap. */}
        <span className="flex shrink-0 items-center">
          <ChevronsUpDown className={cn(comboboxStyles.chevron, iconOnly && 'ml-0')} />
        </span>
      </BaseCombobox.Trigger>

      <BaseCombobox.Portal container={resolvedContainer}>
        <BaseCombobox.Positioner
          align={align}
          sideOffset={4}
          positionMethod={FLOATING_POSITION_METHOD}
          className={comboboxStyles.positioner}
        >
          <BaseCombobox.Popup className={comboboxStyles.popup}>
            <div className={comboboxStyles.searchContainer}>
              <Search className={comboboxStyles.searchIcon} />
              <BaseCombobox.Input className={comboboxStyles.searchInput} placeholder={searchPlaceholder} />
            </div>
            <BaseCombobox.Empty className={comboboxStyles.empty}>{emptyText}</BaseCombobox.Empty>
            <div className={cn(comboboxStyles.listScroller, menu.containerClassName)} {...menu.getContainerProps({})}>
              <FluidMenuItems menu={menu}>
                <BaseCombobox.List className={comboboxStyles.list}>
                  {(option: ComboboxOption) => {
                    const isSelected = selectedValueSet.has(option.value);

                    return (
                      <ComboboxItem key={option.value} value={option} className={comboboxItemClass({ multiple })}>
                        {multiple ? (
                          <>
                            {option.start}
                            <ComboboxOptionText option={option} />
                            <span className={comboboxStyles.itemRightSlot}>
                              {option.end ? <div className={comboboxStyles.optionEnd}>{option.end}</div> : null}
                              <span className={comboboxStyles.checkContainer}>
                                {isSelected ? <Check className={comboboxStyles.checkIcon} /> : null}
                              </span>
                            </span>
                          </>
                        ) : (
                          <>
                            {option.start}
                            <ComboboxOptionText option={option} />
                            <span className={comboboxStyles.itemRightSlot}>
                              {option.end ? <div className={comboboxStyles.optionEnd}>{option.end}</div> : null}
                              <span className={comboboxStyles.checkContainer}>
                                <BaseCombobox.ItemIndicator>
                                  <Check className={comboboxStyles.checkIcon} />
                                </BaseCombobox.ItemIndicator>
                              </span>
                            </span>
                          </>
                        )}
                      </ComboboxItem>
                    );
                  }}
                </BaseCombobox.List>
              </FluidMenuItems>
            </div>
            {selectedValues.length > 0 && clearLabel ? (
              <div className={cn('border-t', 'border-border', 'p-1')}>
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
          </BaseCombobox.Popup>
        </BaseCombobox.Positioner>
      </BaseCombobox.Portal>
    </>
  );

  const root = multiple ? (
    <BaseCombobox.Root
      multiple
      autoHighlight
      items={displayedOptions}
      value={selectedOptions}
      onValueChange={items => props.onValueChange?.((items ?? []).map(item => item.value))}
      disabled={disabled}
      open={open}
      onOpenChange={onOpenChange}
    >
      {comboboxContent}
    </BaseCombobox.Root>
  ) : (
    <BaseCombobox.Root
      autoHighlight
      items={displayedOptions}
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
      {comboboxContent}
    </BaseCombobox.Root>
  );

  // Without an error there is nothing to stack, so the trigger is the root: a wrapper
  // here would hide the trigger from a parent that styles its own children — a
  // ButtonsGroup seam, an InputGroup control, a flex row.
  if (!error) return root;

  return (
    <div className={comboboxStyles.root}>
      {root}
      <FieldBlock.ErrorMsg name={errorName}>{error}</FieldBlock.ErrorMsg>
    </div>
  );
}
