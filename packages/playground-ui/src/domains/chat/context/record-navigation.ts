import { createContext, useContext } from 'react';
import type { KnowledgePageTarget } from '../knowledge/knowledge-links-context';

/**
 * Where the links of a chat read back from a record (a trace) open: the host's callbacks, never a Studio
 * route. A link the host gives no callback for shows as text.
 */
export interface RecordNavigation {
  /** Opens a workspace, at a path of its filesystem when the call named one. */
  onOpenWorkspace?: (target: { workspaceId?: string; path?: string }) => void;
  /** Opens a Knowledge page, named by id or by reference. */
  onOpenKnowledgePage?: (target: KnowledgePageTarget) => void;
}

/** Set where messages are read back from a record; `null` in a live chat, whose links route through Studio. */
export const RecordNavigationContext = createContext<RecordNavigation | null>(null);

export function useRecordNavigation(): RecordNavigation | null {
  return useContext(RecordNavigationContext);
}
