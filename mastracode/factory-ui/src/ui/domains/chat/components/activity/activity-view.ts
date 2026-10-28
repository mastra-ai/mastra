import { createContext, use, useState } from 'react';

/**
 * What the reader did to a stretch: whether it is open, and which rows inside it are open. Outlives the
 * line drawing it, because older history moves a stretch's host into an earlier entry and a prepended user
 * message re-keys its turn.
 */
export interface ActivityView {
  open: boolean;
  openRows: Set<string>;
}

/** Views by member key: any member a remounted stretch still holds finds the view it had. */
export class ActivityViewStore {
  readonly #views = new Map<string, ActivityView>();

  claim(keys: readonly string[]): ActivityView {
    const known = keys.map(key => this.#views.get(key)).find(view => view !== undefined);
    const view = known ?? { open: false, openRows: new Set<string>() };
    this.link(view, keys);
    return view;
  }

  link(view: ActivityView, keys: readonly string[]): void {
    for (const key of keys) this.#views.set(key, view);
  }
}

export const ActivityViewContext = createContext<ActivityViewStore | null>(null);

/** A group of calls keeps a view of its own, apart from the stretch around it. */
export function callsViewKeys(tools: readonly { key: string }[]): string[] {
  return tools.map(tool => `calls:${tool.key}`);
}

export function useActivityViewStore(): ActivityViewStore {
  const store = use(ActivityViewContext);
  if (!store) throw new Error('Activity views need TranscriptEntries');
  return store;
}

/** The view the members had; members that join later are linked when the reader acts on it. */
export function useActivityView(keys: readonly string[]): ActivityView {
  const store = useActivityViewStore();
  const [view] = useState(() => store.claim(keys));
  return view;
}
