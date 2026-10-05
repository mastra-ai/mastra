import type { CollapsiblePanelHandle } from '@mastra/playground-ui/resize/collapsible-panel';
import { createContext, useContext } from 'react';

export interface ThreadsPanelContextValue {
  /** Callback ref for the `CollapsiblePanel` that hosts the threads list. */
  registerPanel: (handle: CollapsiblePanelHandle | null, hasSavedLayout?: boolean) => void;
  collapse: () => void;
  toggle: () => void;
  /** Collapses the panel the first time an agent shows an empty landing; later calls are no-ops. */
  collapseOnce: () => void;
  /** Re-opens the panel only if it was collapsed by `collapseOnce`. */
  expandIfAutoCollapsed: () => void;
}

export const ThreadsPanelContext = createContext<ThreadsPanelContextValue | undefined>(undefined);

/** Returns `undefined` outside a `ThreadsPanelProvider` (e.g. layouts without a threads panel). */
export const useThreadsPanel = () => useContext(ThreadsPanelContext);
