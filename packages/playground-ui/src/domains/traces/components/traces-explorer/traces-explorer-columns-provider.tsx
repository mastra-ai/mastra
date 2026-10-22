import { memo, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { traceColumnActions, useTraceColumnPreferences } from '../../hooks/use-trace-column-preferences';
import type { TracesColumnsState } from '../../trace-saved-views';
import { TracesColumnsContext } from './traces-explorer-context';

type TracesColumnsProviderProps = {
  /** Host-controlled columns; without them the explorer keeps its own in browser storage. */
  columns?: TracesColumnsState;
  onColumnsChange?: (next: TracesColumnsState) => void;
  children: ReactNode;
};

/**
 * The single owner of the column preferences (per-instance state). Memoized so a column toggle
 * doesn't re-run the root's hooks, and a root render (e.g. a trace click) doesn't hand column
 * consumers a fresh preferences object.
 */
export const TracesColumnsProvider = memo(function TracesColumnsProvider({
  columns,
  onColumnsChange,
  children,
}: TracesColumnsProviderProps) {
  if (columns && onColumnsChange) {
    return (
      <ControlledColumnsProvider columns={columns} onColumnsChange={onColumnsChange}>
        {children}
      </ControlledColumnsProvider>
    );
  }
  return <OwnColumnsProvider>{children}</OwnColumnsProvider>;
});

function OwnColumnsProvider({ children }: { children: ReactNode }) {
  const columns = useTraceColumnPreferences();
  return <TracesColumnsContext.Provider value={columns}>{children}</TracesColumnsContext.Provider>;
}

function ControlledColumnsProvider({ columns, onColumnsChange, children }: Required<TracesColumnsProviderProps>) {
  // Read when an action runs, so a host callback that changes every render doesn't hand column
  // consumers a fresh value: it changes only with the columns.
  const latestOnColumnsChange = useRef(onColumnsChange);
  latestOnColumnsChange.current = onColumnsChange;
  const value = useMemo(
    () => ({
      preferences: columns.preferences,
      ...traceColumnActions(update =>
        latestOnColumnsChange.current({ ...columns, preferences: update(columns.preferences) }),
      ),
      order: columns.order,
      onOrderChange: (order: string[]) => latestOnColumnsChange.current({ ...columns, order }),
    }),
    [columns],
  );
  return <TracesColumnsContext.Provider value={value}>{children}</TracesColumnsContext.Provider>;
}
