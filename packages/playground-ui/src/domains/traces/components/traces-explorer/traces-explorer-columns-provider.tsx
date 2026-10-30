import { memo } from 'react';
import type { ReactNode } from 'react';
import { useTraceColumnPreferences } from '../../hooks/use-trace-column-preferences';
import { TracesColumnsContext } from './traces-explorer-context';

/**
 * The single owner of the column preferences (per-instance state). Memoized so a column toggle
 * doesn't re-run the root's hooks, and a root render (e.g. a trace click) doesn't hand column
 * consumers a fresh preferences object.
 */
export const TracesColumnsProvider = memo(function TracesColumnsProvider({ children }: { children: ReactNode }) {
  const columns = useTraceColumnPreferences();
  return <TracesColumnsContext.Provider value={columns}>{children}</TracesColumnsContext.Provider>;
});
