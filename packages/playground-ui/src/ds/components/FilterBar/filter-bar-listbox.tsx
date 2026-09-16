import { CheckIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { useListbox } from './use-listbox';
import { Spinner } from '@/ds/components/Spinner/spinner';
import { menuEmptyClass, menuItemCheckClass, menuItemClass } from '@/ds/primitives/menu-item';
import { cn } from '@/lib/utils';

type ListboxState<T> = Pick<ReturnType<typeof useListbox<T>>, 'listboxId' | 'filtered' | 'getOptionProps'>;

export type FilterBarListboxProps<T> = {
  listbox: ListboxState<T>;
  getKey: (option: T) => string;
  renderOption: (option: T) => ReactNode;
  isSelected?: (option: T) => boolean;
  onSelect: (option: T) => void;
  isLoading?: boolean;
  error?: unknown;
  emptyText?: string;
  'aria-label': string;
  'aria-multiselectable'?: boolean;
};

/**
 * Presentational listbox driven by `useListbox`. Focus stays on the owning
 * input; highlight rides on `data-highlighted`.
 */
export function FilterBarListbox<T>({
  listbox,
  getKey,
  renderOption,
  isSelected,
  onSelect,
  isLoading,
  error,
  emptyText = 'No results.',
  'aria-label': ariaLabel,
  'aria-multiselectable': multiselectable,
}: FilterBarListboxProps<T>) {
  return (
    <div
      id={listbox.listboxId}
      role="listbox"
      aria-label={ariaLabel}
      aria-multiselectable={multiselectable}
      className="max-h-[min(var(--max-height-dropdown-max-height),60dvh)] overflow-y-auto"
    >
      {isLoading && (
        <div className={menuEmptyClass}>
          <Spinner size="sm" />
          <span>Loading…</span>
        </div>
      )}
      {!isLoading && error !== undefined && <div className={menuEmptyClass}>Couldn't load values.</div>}
      {!isLoading && error === undefined && listbox.filtered.length === 0 && (
        <div className={menuEmptyClass}>{emptyText}</div>
      )}
      {listbox.filtered.map((option, index) => {
        const selected = isSelected?.(option) ?? false;
        return (
          <div
            key={getKey(option)}
            {...listbox.getOptionProps(index)}
            data-selected={selected || undefined}
            className={cn(menuItemClass, 'min-w-0 cursor-pointer')}
            onMouseDown={event => event.preventDefault()}
            onClick={() => onSelect(option)}
          >
            <span className="min-w-0 flex-1 truncate">{renderOption(option)}</span>
            {selected && (
              <span className={menuItemCheckClass}>
                <CheckIcon />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
