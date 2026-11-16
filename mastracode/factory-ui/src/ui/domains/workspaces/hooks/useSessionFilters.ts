import { createLocalStorageStore, useLocalStorageStore } from '@mastra/playground-ui/hooks/use-local-storage-store';
import { z } from 'zod';

import {
  EMPTY_SESSION_FILTERS,
  SESSION_STATUS_OPTIONS,
  SESSION_UPDATED_OPTIONS,
  activeSessionFilterCount,
} from '../services/sessionFilters';
import type { SessionFiltersState, SessionStatusFilter, SessionUpdatedFilter } from '../services/sessionFilters';

const optionValue = <T extends string>(options: readonly { value: T }[]) =>
  z.custom<T>(value => options.some(option => option.value === value));

// Each filter falls back on its own, so one stale value doesn't clear the others.
// An owner who left the factory still parses; the filter then lists nothing until it is reset.
const sessionFiltersSchema: z.ZodType<SessionFiltersState> = z.object({
  owner: z.string().catch(EMPTY_SESSION_FILTERS.owner),
  status: optionValue<SessionStatusFilter>(SESSION_STATUS_OPTIONS).catch(EMPTY_SESSION_FILTERS.status),
  updated: optionValue<SessionUpdatedFilter>(SESSION_UPDATED_OPTIONS).catch(EMPTY_SESSION_FILTERS.updated),
});

function changesFromEmpty(filters: SessionFiltersState): Partial<SessionFiltersState> {
  const changes: Partial<SessionFiltersState> = {};
  if (filters.owner !== EMPTY_SESSION_FILTERS.owner) changes.owner = filters.owner;
  if (filters.status !== EMPTY_SESSION_FILTERS.status) changes.status = filters.status;
  if (filters.updated !== EMPTY_SESSION_FILTERS.updated) changes.updated = filters.updated;
  return changes;
}

const sessionFiltersStore = createLocalStorageStore<SessionFiltersState>({
  key: 'mastracode.sessionFilters',
  defaultValue: EMPTY_SESSION_FILTERS,
  parse: stored => sessionFiltersSchema.parse(stored),
  toJSON: changesFromEmpty,
});

export function useSessionFilters() {
  const filters = useLocalStorageStore(sessionFiltersStore);

  return {
    filters,
    activeFilterCount: activeSessionFilterCount(filters),
    changeFilters: (changes: Partial<SessionFiltersState>) =>
      sessionFiltersStore.write({ ...sessionFiltersStore.read(), ...changes }),
    resetFilters: () => sessionFiltersStore.write(EMPTY_SESSION_FILTERS),
  };
}
