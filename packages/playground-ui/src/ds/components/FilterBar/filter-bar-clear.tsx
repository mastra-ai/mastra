import { useFilterBarContext } from './filter-bar-context';
import { ClearFiltersButton } from '@/ds/components/ClearFiltersButton/clear-filters-button';

/** Removes every removable filter. Rendered by FilterBar at its trailing edge; hidden while nothing can be removed. */
export function FilterBarClear({ label }: { label: string }) {
  const ctx = useFilterBarContext();
  if (!ctx.hasRemovableItems) return null;
  return (
    <ClearFiltersButton
      label={label}
      onClick={event => {
        event.stopPropagation();
        ctx.clear();
        ctx.focusInput();
      }}
    />
  );
}
