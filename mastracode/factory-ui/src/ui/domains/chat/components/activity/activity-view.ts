import { createContext, use, useState } from 'react';

/** The row a panel was scrolled to, and how far its top sat below the panel's top. */
export interface RowAnchor {
  key: string;
  offset: number;
}

/** A scrolling list of calls: whether its group is open, and the row the reader scrolled it to. */
export interface PanelView {
  open: boolean;
  anchor?: RowAnchor;
}

/**
 * What the reader did to a stretch. Outlives the line drawing it: a thought joining a run of calls folds them
 * into a group, older history moves a stretch's host into an earlier entry, and a prepended user message
 * re-keys its turn.
 */
export interface ActivityView {
  open: boolean;
  openRows: Set<string>;
  panels: Map<string, PanelView>;
}

/** Views by member key: any member a remounted stretch still holds finds the view it had. */
export class ActivityViewStore {
  readonly #views = new Map<string, ActivityView>();

  claim(keys: readonly string[]): ActivityView {
    const known = keys.map(key => this.#views.get(key)).find(view => view !== undefined);
    const view = known ?? { open: false, openRows: new Set<string>(), panels: new Map<string, PanelView>() };
    this.link(view, keys);
    return view;
  }

  link(view: ActivityView, keys: readonly string[]): void {
    for (const key of keys) this.#views.set(key, view);
  }
}

export const ActivityViewContext = createContext<ActivityViewStore | null>(null);

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

/** The panel any of these calls was listed in, so a group and the list it folds share where the reader left them. */
export function usePanelView(view: ActivityView, keys: readonly string[], openIfNew: boolean): PanelView {
  const [panel] = useState(() => {
    const known = keys.map(key => view.panels.get(key)).find(found => found !== undefined);
    const claimed = known ?? { open: openIfNew };
    for (const key of keys) view.panels.set(key, claimed);
    return claimed;
  });
  return panel;
}
