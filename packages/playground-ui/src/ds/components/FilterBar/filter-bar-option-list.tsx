import { CheckIcon } from 'lucide-react';
import { forwardRef } from 'react';
import type { ReactNode } from 'react';
import { ComboboxPrimitive, comboboxStyles } from '@/ds/components/Combobox';
import { Spinner } from '@/ds/components/Spinner/spinner';
import { FluidMenuItems, useFluidMenu, useFluidMenuItemRef } from '@/ds/primitives/fluid-menu';
import { cn } from '@/lib/utils';

export type FilterBarOptionListProps<T> = {
  getKey: (option: T) => string;
  renderOption: (option: T) => ReactNode;
  /** Explicit check mark, used where Base UI's selection state is not the source of truth (multi-value step). */
  isSelected?: (option: T) => boolean;
  isLoading?: boolean;
  error?: unknown;
  emptyText?: string;
  'aria-label': string;
  'aria-multiselectable'?: boolean;
};

const FluidItem = forwardRef<HTMLDivElement, ComboboxPrimitive.Item.Props>((props, ref) => (
  <ComboboxPrimitive.Item ref={useFluidMenuItemRef(ref)} {...props} />
));
FluidItem.displayName = 'FilterBarOptionItem';

/**
 * List/status/empty rows for a `ComboboxPrimitive.Root`, laid out like the DS
 * `Combobox` popup (fluid hover highlight, scroller around the list). Items come
 * from the root's `items`; highlight and keyboard navigation are owned by Base UI.
 */
export function FilterBarOptionList<T>({
  getKey,
  renderOption,
  isSelected,
  isLoading,
  error,
  emptyText = 'No results.',
  'aria-label': ariaLabel,
  'aria-multiselectable': multiselectable,
}: FilterBarOptionListProps<T>) {
  const idle = !isLoading && error === undefined;
  const menu = useFluidMenu<HTMLDivElement>();
  return (
    <>
      {isLoading && (
        <ComboboxPrimitive.Status className={comboboxStyles.empty}>
          <Spinner size="sm" />
          <span>Loading…</span>
        </ComboboxPrimitive.Status>
      )}
      {!isLoading && error !== undefined && (
        <ComboboxPrimitive.Status className={comboboxStyles.empty}>Couldn't load values.</ComboboxPrimitive.Status>
      )}
      <ComboboxPrimitive.Empty className={comboboxStyles.empty}>{idle ? emptyText : null}</ComboboxPrimitive.Empty>
      <div
        className={cn(
          comboboxStyles.listScroller,
          'max-h-[min(var(--max-height-dropdown),60dvh)]',
          menu.containerClassName,
        )}
        {...menu.getContainerProps({})}
      >
        <FluidMenuItems menu={menu}>
          <ComboboxPrimitive.List
            aria-label={ariaLabel}
            aria-multiselectable={multiselectable}
            className={comboboxStyles.list}
          >
            {(option: T) => {
              const selected = isSelected?.(option) ?? false;
              return (
                <FluidItem
                  key={getKey(option)}
                  value={option}
                  data-selected={selected || undefined}
                  className={cn(comboboxStyles.item, 'min-w-0')}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate">{renderOption(option)}</span>
                  <span className={comboboxStyles.itemRightSlot}>
                    <span className={comboboxStyles.checkContainer}>
                      {isSelected ? (
                        selected && <CheckIcon className={comboboxStyles.checkIcon} />
                      ) : (
                        <ComboboxPrimitive.ItemIndicator>
                          <CheckIcon className={comboboxStyles.checkIcon} />
                        </ComboboxPrimitive.ItemIndicator>
                      )}
                    </span>
                  </span>
                </FluidItem>
              );
            }}
          </ComboboxPrimitive.List>
        </FluidMenuItems>
      </div>
    </>
  );
}
