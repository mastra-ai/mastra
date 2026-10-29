import { createContext, use, useState, useSyncExternalStore } from 'react';

import { ActivityDisclosureStore } from './model/disclosure-store';
import type { DisclosureScope } from './model/disclosure-store';

export const ActivityDisclosureContext = createContext<ActivityDisclosureStore | undefined>(undefined);

export function useDisclosureStore(): ActivityDisclosureStore {
  const shared = use(ActivityDisclosureContext);
  const [own] = useState(() => shared ?? new ActivityDisclosureStore());
  return shared ?? own;
}

export function useIsOpen(store: ActivityDisclosureStore, scope: DisclosureScope, keys: readonly string[]): boolean {
  return useSyncExternalStore(store.subscribe, () => store.isOpen(scope, keys));
}

/** A call's row in an open stretch: open as the reader left it; opening it keeps the group around it open too. */
export function useActivityRow(key: string): { open: boolean; onOpenChange: (open: boolean) => void } {
  const store = useDisclosureStore();
  const open = useIsOpen(store, 'row', [key]);

  function onOpenChange(next: boolean) {
    store.setOpen('row', [key], next);
    if (next) store.setOpen('group', [key], true);
  }

  return { open, onOpenChange };
}
