import { useCallback, useMemo, useState } from 'react';

/**
 * Flat toolkit selection for the left filter pane. `null` means "all checked"
 * (the default) so a freshly-opened picker shows every tool without us having
 * to enumerate toolkit ids up front. Provider grouping is presentational only —
 * this state is keyed by bare toolkit id.
 */
export const useToolkitSelection = (allToolkitIds: string[]) => {
  const [selected, setSelected] = useState<Set<string> | null>(null);

  const isChecked = useCallback((id: string) => selected === null || selected.has(id), [selected]);

  const toggle = useCallback(
    (id: string) => {
      setSelected(prev => {
        const next = new Set(prev ?? allToolkitIds);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    },
    [allToolkitIds],
  );

  // `null` (not a snapshot Set) so toolkits discovered later stay checked.
  const selectAll = useCallback(() => setSelected(null), []);
  const clearAll = useCallback(() => setSelected(new Set()), []);

  const allUnchecked = useMemo(() => selected !== null && selected.size === 0, [selected]);

  return { selected, isChecked, toggle, selectAll, clearAll, allUnchecked };
};
