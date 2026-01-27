import { Combobox as BaseCombobox } from '@base-ui/react/combobox';
import { buttonVariants } from '@/ds/components/Button/Button';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import * as React from 'react';
import { type FormElementSize } from '@/ds/primitives/form-element';
import { transitions } from '@/ds/primitives/transitions';

export type ComboboxOption = {
  label: string;
  value: string;
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
  variant?: 'default' | 'light' | 'outline' | 'ghost';
  size?: FormElementSize;
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
}: ComboboxProps) {
  const selectedOption = options.find(option => option.value === value) ?? null;

  const handleSelect = (item: ComboboxOption | null) => {
    if (item) {
      onValueChange?.(item.value);
    }
  };

  return (
    <BaseCombobox.Root items={options} value={selectedOption} onValueChange={handleSelect} disabled={disabled}>
      <BaseCombobox.Trigger className={cn(buttonVariants({ variant, size }), 'w-full justify-between', className)}>
        <span className="truncate">
          <BaseCombobox.Value placeholder={placeholder} />
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </BaseCombobox.Trigger>

      <BaseCombobox.Portal>
        <BaseCombobox.Positioner align="start" sideOffset={4}>
          <BaseCombobox.Popup
            className={cn(
              'min-w-[var(--anchor-width)] w-max rounded-md bg-surface3 text-neutral5',
              'shadow-elevated',
              'origin-[var(--transform-origin)]',
              'transition-[transform,scale,opacity] duration-150 ease-out',
              'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
              'data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
            )}
          >
            <div className={cn('flex items-center border-b border-border1 px-3 py-2', transitions.colors)}>
              <Search className={cn('mr-2 h-4 w-4 shrink-0 text-neutral3', transitions.colors)} />
              <BaseCombobox.Input
                className={cn(
                  'flex h-8 w-full rounded-md bg-transparent py-1 text-sm',
                  'placeholder:text-neutral3 disabled:cursor-not-allowed disabled:opacity-50',
                  'outline-none',
                  transitions.colors,
                )}
                placeholder={searchPlaceholder}
              />
            </div>
            <BaseCombobox.Empty className="[&:not(:empty)]:block hidden py-6 text-center text-sm text-neutral3">
              {emptyText}
            </BaseCombobox.Empty>
            <BaseCombobox.List className="max-h-dropdown-max-height overflow-y-auto overflow-x-hidden p-1">
              {(option: ComboboxOption) => (
                <BaseCombobox.Item
                  key={option.value}
                  value={option}
                  className={cn(
                    'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm',
                    transitions.colors,
                    'data-[highlighted]:bg-surface5 data-[highlighted]:text-neutral5',
                    'data-[selected]:bg-accent1Dark data-[selected]:text-accent1',
                  )}
                >
                  <span className="mr-2 flex h-4 w-4 shrink-0 items-center justify-center">
                    <BaseCombobox.ItemIndicator>
                      <Check className={cn('h-4 w-4 text-accent1', transitions.opacity)} />
                    </BaseCombobox.ItemIndicator>
                  </span>
                  <span className="whitespace-nowrap">{option.label}</span>
                </BaseCombobox.Item>
              )}
            </BaseCombobox.List>
          </BaseCombobox.Popup>
        </BaseCombobox.Positioner>
      </BaseCombobox.Portal>
    </BaseCombobox.Root>
  );
}
