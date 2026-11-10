import { useState } from 'react';

import { EMPTY_SESSION_FILTERS, activeSessionFilterCount } from '../services/sessionFilters';
import type { SessionFiltersState } from '../services/sessionFilters';

export function useSessionFilters() {
  const [filterChanges, setFilterChanges] = useState<Partial<SessionFiltersState>>({});
  const filters: SessionFiltersState = { ...EMPTY_SESSION_FILTERS, ...filterChanges };

  return {
    filters,
    activeFilterCount: activeSessionFilterCount(filters),
    changeFilters: (changes: Partial<SessionFiltersState>) => setFilterChanges(current => ({ ...current, ...changes })),
    resetFilters: () => setFilterChanges({}),
  };
}
