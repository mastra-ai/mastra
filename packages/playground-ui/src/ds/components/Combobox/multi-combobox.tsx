import { Combobox as BaseCombobox } from '@base-ui/react/combobox';
import { buttonVariants } from '@/ds/components/Button/Button';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import * as React from 'react';
import { type FormElementSize } from '@/ds/primitives/form-element';
import { comboboxStyles } from './combobox-styles';
import type { ComboboxOption } from './combobox';

export type { ComboboxOption };

export type MultiComboboxProps = {
  options: ComboboxOption[];
  value?: string[];
  onValueChange?: (value: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  variant?: 'default' | 'light' | 'outline' | 'ghost';
  size?: FormElementSize;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  container?: HTMLElement | ShadowRoot | null | React.RefObject<HTMLElement | ShadowRoot | null>;
  error?: string;
};

export function MultiCombobox({
  options,
  value = [],
  onValueChange,
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
  error,
}: MultiComboboxProps) {
  const selectedOptions = options.filter(option => value.includes(option.value));

  const handleSelect = (items: ComboboxOption[] | null) => {
    if (items) {
      onValueChange?.(items.map(item => item.value));
    }
  };

  const triggerText = selectedOptions.length === 0 ? placeholder : `${selectedOptions.length} selected`;

  return (
    <div className={comboboxStyles.root}>
      <BaseCombobox.Root
        multiple
        items={options}
        value={selectedOptions}
        onValueChange={handleSelect}
        disabled={disabled}
        open={open}
        onOpenChange={onOpenChange}
      >
        <BaseCombobox.Trigger
          className={cn(
            buttonVariants({ variant, size }),
            comboboxStyles.trigger,
            error && comboboxStyles.triggerError,
            className,
          )}
        >
          <span className={cn('truncate', selectedOptions.length === 0 && comboboxStyles.placeholder)}>
            {triggerText}
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
                {(option: ComboboxOption) => {
                  const isSelected = value.includes(option.value);
                  return (
                    <BaseCombobox.Item key={option.value} value={option} className={comboboxStyles.item}>
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
                        <span className={comboboxStyles.optionText}>
                          <span className={comboboxStyles.optionLabel}>{option.label}</span>
                          {option.description && (
                            <span className={comboboxStyles.optionDescription}>{option.description}</span>
                          )}
                        </span>
                        {option.end ? <div className={comboboxStyles.optionEnd}>{option.end}</div> : null}
                      </span>
                    </BaseCombobox.Item>
                  );
                }}
              </BaseCombobox.List>
            </BaseCombobox.Popup>
          </BaseCombobox.Positioner>
        </BaseCombobox.Portal>
      </BaseCombobox.Root>
      {error && <span className={comboboxStyles.error}>{error}</span>}
    </div>
  );
}
