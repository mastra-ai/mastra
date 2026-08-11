import { SETTINGS_SECTION_LABELS } from '../../settings/settingsSections';

export type GlobalSearchScope = 'all' | 'navigation' | 'work' | 'review' | 'items' | 'user' | 'factories';

export interface GlobalSearchScopeCounts {
  all: number;
  navigation: number;
  work: number;
  review: number;
  items: number;
  user: number;
  factories: number;
}

const FACTORY_NAVIGATION_COUNT = 5;
export const GLOBAL_SEARCH_NAVIGATION_COUNT = FACTORY_NAVIGATION_COUNT + Object.keys(SETTINGS_SECTION_LABELS).length;

export function createGlobalSearchScopeCounts({
  work,
  review,
  items,
  user,
  factories,
}: {
  work: number;
  review: number;
  items: number;
  user: number;
  factories: number;
}): GlobalSearchScopeCounts {
  return {
    all: GLOBAL_SEARCH_NAVIGATION_COUNT + work + review + items + user + factories,
    navigation: GLOBAL_SEARCH_NAVIGATION_COUNT,
    work,
    review,
    items,
    user,
    factories,
  };
}

export function scopeIncludes(activeScope: GlobalSearchScope, scope: Exclude<GlobalSearchScope, 'all'>): boolean {
  return activeScope === 'all' || activeScope === scope;
}

export function isSessionScope(scope: GlobalSearchScope): boolean {
  switch (scope) {
    case 'all':
    case 'work':
    case 'review':
    case 'user':
      return true;
    case 'navigation':
    case 'items':
    case 'factories':
      return false;
  }
}

/** Work items title the session results as well as backing the board-card ones. */
export function isWorkItemScope(scope: GlobalSearchScope): boolean {
  switch (scope) {
    case 'all':
    case 'work':
    case 'review':
    case 'items':
      return true;
    case 'navigation':
    case 'user':
    case 'factories':
      return false;
  }
}
