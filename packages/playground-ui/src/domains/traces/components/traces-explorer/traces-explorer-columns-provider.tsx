import { memo, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { TraceColumnPreferences } from '../../trace-list-columns';
import { TracesColumnsContext } from './traces-explorer-context';
import type { TracesColumnsContextValue } from './traces-explorer-context';

type TracesColumnsProviderProps = {
  preferences: TraceColumnPreferences;
  /** Stable: the root forwards it to the host's latest `onColumnsChange`. */
  setPreferences: (next: TraceColumnPreferences) => void;
  defaults: TraceColumnPreferences;
  children: ReactNode;
};

/**
 * Hands the host's column selection to the parts. Memoized so a root render (e.g. a trace click)
 * doesn't hand column consumers a fresh value while the columns stay the same.
 */
export const TracesColumnsProvider = memo(function TracesColumnsProvider({
  preferences,
  setPreferences,
  defaults,
  children,
}: TracesColumnsProviderProps) {
  const value = useMemo<TracesColumnsContextValue>(
    () => ({ preferences, setPreferences, resetColumns: () => setPreferences(defaults) }),
    [preferences, setPreferences, defaults],
  );
  return <TracesColumnsContext.Provider value={value}>{children}</TracesColumnsContext.Provider>;
});
