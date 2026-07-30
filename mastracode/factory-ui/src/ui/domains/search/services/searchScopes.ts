import { SETTINGS_SECTION_LABELS } from '../../settings/settingsSections';

export type GlobalSearchScope = 'all' | 'navigation' | 'work' | 'review' | 'user' | 'factories';

export interface GlobalSearchScopeCounts {
  all: number;
  navigation: number;
  work: number;
  review: number;
  user: number;
  factories: number;
}

const FACTORY_NAVIGATION_COUNT = 5;
export const GLOBAL_SEARCH_NAVIGATION_COUNT = FACTORY_NAVIGATION_COUNT + Object.keys(SETTINGS_SECTION_LABELS).length;

export function createGlobalSearchScopeCounts({
  work,
  review,
  user,
  factories,
}: {
  work: number;
  review: number;
  user: number;
  factories: number;
}): GlobalSearchScopeCounts {
  return {
    all: GLOBAL_SEARCH_NAVIGATION_COUNT + work + review + user + factories,
    navigation: GLOBAL_SEARCH_NAVIGATION_COUNT,
    work,
    review,
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
    case 'factories':
      return false;
  }
}
