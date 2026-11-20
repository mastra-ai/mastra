import { useTracesDateWindow } from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import type { TracesFilters } from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import { useMemo, useState } from 'react';
import type { DiscoveryWindow } from './values-resolver';

/** The window a selection is discovered in: its date window, ending when the explorer opened. */
export function useDiscoveryWindow(filters: TracesFilters): DiscoveryWindow {
  const { dateFrom, dateTo } = useTracesDateWindow(filters);
  const [now] = useState(() => new Date());
  return useMemo(
    () => ({ from: (dateFrom ?? now).toISOString(), to: (dateTo ?? now).toISOString() }),
    [dateFrom, dateTo, now],
  );
}
