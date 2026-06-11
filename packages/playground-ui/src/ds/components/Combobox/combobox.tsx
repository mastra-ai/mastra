import { Combobox as BaseCombobox } from '@base-ui/react/combobox';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import * as React from 'react';
import { comboboxStyles, comboboxTriggerClass } from './combobox-styles';
import type { ComboboxVariant } from './combobox-styles';
import type { TextButtonSize } from '@/ds/components/Button/Button';
import { usePortalContainer } from '@/ds/primitives/portal-container';

export type { ComboboxVariant } from './combobox-styles';

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
  variant?: ComboboxVariant;
  size?: TextButtonSize;
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
  variant = 'default',
  size = 'md',
  open,
  onOpenChange,
  container,
  error,
}: ComboboxProps) {
  const selectedOption = options.find(option => option.value === value) ?? null;

  // Default to the nearest SideDialog/Drawer popup so the list stays
  // interactive inside a modal drawer; an explicit `container` still wins.
  const resolvedContainer = usePortalContainer(container);

  const handleSelect = (item: ComboboxOption | null) => {
    if (item) {
      onValueChange?.(item.value);
    }
  };

  return (
    <div className={comboboxStyles.root}>
      <BaseCombobox.Root
        autoHighlight
        items={options}
        value={selectedOption}
        onValueChange={handleSelect}
        disabled={disabled}
        open={open}
        onOpenChange={onOpenChange}
      >
        <BaseCombobox.Trigger className={comboboxTriggerClass({ variant, size, error: Boolean(error), className })}>
          {/* Keep truncation off the outer wrapper so start adornments are not clipped. */}
          <span className="flex items-center gap-2 min-w-0 flex-1">
            {selectedOption?.start}
            <span className="truncate">
              <BaseCombobox.Value placeholder={placeholder} />
            </span>
          </span>
          {/* Wrap the chevron in a `<span>` so the svg is one level deep and
              escapes Button's `[&>svg]` adornments (negative `mx`, forced
              opacity/size) — mirrors Select's chevron wrap. */}
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
                {(option: ComboboxOption) => (
                  <BaseCombobox.Item key={option.value} value={option} className={comboboxStyles.item}>
                    {option.start}
                    <span className={comboboxStyles.optionText}>
                      <span className={comboboxStyles.optionLabel}>{option.label}</span>
                      {option.description && (
                        <span className={comboboxStyles.optionDescription}>{option.description}</span>
                      )}
                    </span>
                    <span className={comboboxStyles.itemRightSlot}>
                      {option.end ? <div className={comboboxStyles.optionEnd}>{option.end}</div> : null}
                      <span className={comboboxStyles.checkContainer}>
                        <BaseCombobox.ItemIndicator>
                          <Check className={comboboxStyles.checkIcon} />
                        </BaseCombobox.ItemIndicator>
                      </span>
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
