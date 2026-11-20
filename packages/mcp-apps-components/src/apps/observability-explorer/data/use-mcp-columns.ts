import type { SavedViewColumnsControl } from '@mastra/playground-ui/domains/observability/saved-views/use-hosted-saved-views';
import { TRACE_COLUMN_CATALOGS } from '@mastra/playground-ui/domains/traces/trace-list-columns';
import type { TraceColumnScope } from '@mastra/playground-ui/domains/traces/trace-list-columns';
import { useCallback, useMemo, useState } from 'react';

/** Column choices for one list, kept for the life of the app. */
export function useMcpColumns(scope: TraceColumnScope): SavedViewColumnsControl {
  const defaults = TRACE_COLUMN_CATALOGS[scope].defaults;
  const [preferences, setPreferences] = useState(defaults);
  const resetColumns = useCallback(() => setPreferences(defaults), [defaults]);
  return useMemo(() => ({ preferences, setPreferences, resetColumns }), [preferences, resetColumns]);
}
