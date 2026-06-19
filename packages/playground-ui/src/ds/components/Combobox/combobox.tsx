import { Combobox as BaseCombobox } from '@base-ui/react/combobox';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import * as React from 'react';
import { comboboxItemClass, comboboxStyles, comboboxTriggerClass } from './combobox-styles';
import type { ComboboxVariant } from './combobox-styles';
import type { TextButtonSize } from '@/ds/components/Button/Button';
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
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  variant?: ComboboxVariant;
  size?: TextButtonSize;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  container?: HTMLElement | ShadowRoot | null | React.RefObject<HTMLElement | ShadowRoot | null>;
  error?: string;
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
};

export type ComboboxProps = ComboboxSingleProps | ComboboxMultipleProps;

const EMPTY_VALUES: string[] = [];
const EMPTY_OPTIONS: ComboboxOption[] = [];

function isMultipleCombobox(props: ComboboxProps): props is ComboboxMultipleProps {
  return props.multiple === true;
}

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
  } = props;
  const multiple = isMultipleCombobox(props);
  const selectedValues = multiple ? (props.value ?? EMPTY_VALUES) : EMPTY_VALUES;
  const selectedValueSet = React.useMemo(() => new Set(selectedValues), [selectedValues]);
  const selectedOption = multiple ? null : (options.find(option => option.value === props.value) ?? null);
  const selectedOptions = multiple ? options.filter(option => selectedValueSet.has(option.value)) : EMPTY_OPTIONS;
  const triggerText = selectedOptions.length === 0 ? placeholder : `${selectedOptions.length} selected`;
  // Default to the nearest SideDialog/Drawer popup so the list stays
  // interactive inside a modal drawer; an explicit `container` still wins.
  const resolvedContainer = usePortalContainer(container);

  const comboboxContent = (
    <>
      <BaseCombobox.Trigger className={comboboxTriggerClass({ variant, size, error: Boolean(error), className })}>
        {multiple ? (
          <span className={cn('truncate', selectedOptions.length === 0 && comboboxStyles.placeholder)}>
            {triggerText}
          </span>
        ) : (
          // Keep truncation off the outer wrapper so start adornments are not clipped.
          <span className="flex items-center gap-2 min-w-0 flex-1">
            {selectedOption?.start}
            <span className="truncate">
              <BaseCombobox.Value placeholder={placeholder} />
            </span>
          </span>
        )}
        {/* Wrap the chevron in a `<span>` so the svg is one level deep and
            escapes Button's `[&>svg]` adornments — mirrors Select's chevron wrap. */}
        <span className="flex shrink-0 items-center">
          <ChevronsUpDown className={comboboxStyles.chevron} />
        </span>
      </BaseCombobox.Trigger>

      <BaseCombobox.Portal container={resolvedContainer}>
        <BaseCombobox.Positioner align="start" sideOffset={4} className={comboboxStyles.positioner}>
          <BaseCombobox.Popup className={comboboxStyles.popup}>
            <div className={comboboxStyles.searchContainer}>
              <Search className={comboboxStyles.searchIcon} />
              <BaseCombobox.Input className={comboboxStyles.searchInput} placeholder={searchPlaceholder} />
            </div>
            <BaseCombobox.Empty className={comboboxStyles.empty}>{emptyText}</BaseCombobox.Empty>
            <BaseCombobox.List className={comboboxStyles.list}>
              {(option: ComboboxOption) => {
                const isSelected = selectedValueSet.has(option.value);

                return (
                  <BaseCombobox.Item key={option.value} value={option} className={comboboxItemClass({ multiple })}>
                    {multiple ? (
                      <>
                        <span
                          className={cn(
                            comboboxStyles.checkbox,
                            isSelected ? comboboxStyles.checkboxSelected : comboboxStyles.checkboxUnselected,
                          )}
                        >
                          {isSelected && <Check className={comboboxStyles.checkboxIcon} />}
                        </span>
                        <span className={comboboxStyles.optionContent}>
                          {option.start}
                          <ComboboxOptionText option={option} />
                          {option.end ? <div className={comboboxStyles.optionEnd}>{option.end}</div> : null}
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
                  </BaseCombobox.Item>
                );
              }}
            </BaseCombobox.List>
          </BaseCombobox.Popup>
        </BaseCombobox.Positioner>
      </BaseCombobox.Portal>
    </>
  );

  if (multiple) {
    return (
      <div className={comboboxStyles.root}>
        <BaseCombobox.Root
          multiple
          autoHighlight
          items={options}
          value={selectedOptions}
          onValueChange={items => props.onValueChange?.((items ?? []).map(item => item.value))}
          disabled={disabled}
          open={open}
          onOpenChange={onOpenChange}
        >
          {comboboxContent}
        </BaseCombobox.Root>
        {error && <span className={comboboxStyles.error}>{error}</span>}
      </div>
    );
  }

  return (
    <div className={comboboxStyles.root}>
      <BaseCombobox.Root
        autoHighlight
        items={options}
        value={selectedOption}
        onValueChange={item => {
          if (item) {
            props.onValueChange?.(item.value);
          }
        }}
        disabled={disabled}
        open={open}
        onOpenChange={onOpenChange}
      >
        {comboboxContent}
      </BaseCombobox.Root>
      {error && <span className={comboboxStyles.error}>{error}</span>}
    </div>
  );
}
