import { useState } from 'react';

import { activeSessionFilterCount, defaultSessionFilters } from '../services/sessionFilters';
import type { SessionFiltersState } from '../services/sessionFilters';

export function useSessionFilters(viewerUserId: string | undefined) {
  const [filterChanges, setFilterChanges] = useState<Partial<SessionFiltersState>>({});
  const defaultFilters = defaultSessionFilters(viewerUserId);
  const filters: SessionFiltersState = { ...defaultFilters, ...filterChanges };

  return {
    filters,
    activeFilterCount: activeSessionFilterCount(filters, defaultFilters),
    changeFilters: (changes: Partial<SessionFiltersState>) => setFilterChanges(current => ({ ...current, ...changes })),
    resetFilters: () => setFilterChanges({}),
  };
}
