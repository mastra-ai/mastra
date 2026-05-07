import { Combobox as BaseCombobox } from '@base-ui/react/combobox';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import * as React from 'react';
import { comboboxStyles } from './combobox-styles';
import { formElementSizes } from '@/ds/primitives/form-element';
import type { FormElementSize } from '@/ds/primitives/form-element';
import { cn } from '@/lib/utils';

export type ComboboxOption = {
  label: string;
  value: string;
  description?: string;
  start?: React.ReactNode;
  end?: React.ReactNode;
};

export type ComboboxProps = {
  options: ComboboxOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  /** Kept for API compatibility; trigger styling is intrinsic to the Combobox now. */
  variant?: 'default' | 'ghost' | 'link';
  size?: Exclude<FormElementSize, 'lg'>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  container?: HTMLElement | ShadowRoot | null | React.RefObject<HTMLElement | ShadowRoot | null>;
  error?: string;
};

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = 'Select option...',
  searchPlaceholder = 'Search...',
  emptyText = 'No option found.',
  className,
  disabled = false,
  size = 'default',
  open,
  onOpenChange,
  container,
  error,
}: ComboboxProps) {
  const selectedOption = options.find(option => option.value === value) ?? null;

  const handleSelect = (item: ComboboxOption | null) => {
    if (item) {
      onValueChange?.(item.value);
    }
  };

  return (
    <div className={comboboxStyles.root}>
      <BaseCombobox.Root
        items={options}
        value={selectedOption}
        onValueChange={handleSelect}
        disabled={disabled}
        open={open}
        onOpenChange={onOpenChange}
      >
        <BaseCombobox.Trigger
          className={cn(
            comboboxStyles.trigger,
            formElementSizes[size],
            error && comboboxStyles.triggerError,
            className,
          )}
        >
          {/* Keep truncation off the outer wrapper so start adornments are not clipped. */}
          <span className="flex items-center gap-2 min-w-0 flex-1">
            {selectedOption?.start}
            <span className="truncate">
              <BaseCombobox.Value placeholder={placeholder} />
            </span>
          </span>
          <ChevronsUpDown className={comboboxStyles.chevron} />
        </BaseCombobox.Trigger>

        <BaseCombobox.Portal container={container}>
          <BaseCombobox.Positioner align="start" sideOffset={4} className={comboboxStyles.positioner}>
            <BaseCombobox.Popup className={comboboxStyles.popup}>
              <div className={comboboxStyles.searchContainer}>
                <Search className={comboboxStyles.searchIcon} />
                <BaseCombobox.Input className={comboboxStyles.searchInput} placeholder={searchPlaceholder} />
              </div>
              <BaseCombobox.Empty className={comboboxStyles.empty}>{emptyText}</BaseCombobox.Empty>
              <BaseCombobox.List className={comboboxStyles.list}>
                {(option: ComboboxOption) => (
                  <BaseCombobox.Item
                    key={option.value}
                    value={option}
                    className={cn(comboboxStyles.item, comboboxStyles.itemSelected)}
                  >
                    <span className={comboboxStyles.checkContainer}>
                      <BaseCombobox.ItemIndicator>
                        <Check className={comboboxStyles.checkIcon} />
                      </BaseCombobox.ItemIndicator>
                    </span>
                    <span className={comboboxStyles.optionContent}>
                      {option.start}
                      <span className={comboboxStyles.optionText}>
                        <span className={comboboxStyles.optionLabel}>{option.label}</span>
                        {option.description && (
                          <span className={comboboxStyles.optionDescription}>{option.description}</span>
                        )}
                      </span>
                      {option.end ? <div className={comboboxStyles.optionEnd}>{option.end}</div> : null}
                    </span>
                  </BaseCombobox.Item>
                )}
              </BaseCombobox.List>
            </BaseCombobox.Popup>
          </BaseCombobox.Positioner>
        </BaseCombobox.Portal>
      </BaseCombobox.Root>
      {error && <span className={comboboxStyles.error}>{error}</span>}
    </div>
  );
}
