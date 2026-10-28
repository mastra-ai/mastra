import { useState } from 'react';
import type { ReactNode } from 'react';

import { ActivityDisclosureStore } from './model/disclosure-store';
import { ActivityDisclosureContext } from './use-activity-disclosure';

/** Keeps what the reader opened in every stretch below it, through remounts. Without it, each line keeps its own. */
export function ActivityDisclosureProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => new ActivityDisclosureStore());
  return <ActivityDisclosureContext value={store}>{children}</ActivityDisclosureContext>;
}
