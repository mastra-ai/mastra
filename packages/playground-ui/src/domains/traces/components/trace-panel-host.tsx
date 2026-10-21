import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { AddDatasetItemDialogProps } from '@/domains/datasets';
import type { LightSpanRecord } from '@/domains/traces/types';

/**
 * App integrations of the trace drawers (routing, app-only actions, dialogs owned by the host app).
 * Mount once near the app root; every trace panel reads it at the leaf that needs it.
 */
export interface TracePanelHost {
  /** Opens a score of a trace (e.g. navigates to the score page). Score cards are read-only without it. */
  openScore?: (traceId: string, scoreId: string) => void;
  /** Extra actions rendered in the trace drawer header. */
  renderHeaderActions?: (args: { traceId: string; spans: LightSpanRecord[] | undefined }) => ReactNode;
  /** Lets "Add to dataset" dialogs offer creating a new dataset. */
  renderCreateDatasetDialog?: AddDatasetItemDialogProps['renderCreateDatasetDialog'];
}

const EMPTY_HOST: TracePanelHost = {};

const TracePanelHostContext = createContext<TracePanelHost>(EMPTY_HOST);

/** Pass a stable `value` (module constant or memoized) so trace panels don't re-render with the host. */
export function TracePanelHostProvider({ value, children }: { value: TracePanelHost; children: ReactNode }) {
  return <TracePanelHostContext.Provider value={value}>{children}</TracePanelHostContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- provider and its hook intentionally share this module
export function useTracePanelHost() {
  return useContext(TracePanelHostContext);
}
