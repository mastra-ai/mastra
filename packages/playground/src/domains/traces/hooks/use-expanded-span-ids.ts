import { getAllSpanIds } from '@mastra/playground-ui/domains/traces/hooks/get-all-span-ids';
import type { UISpan } from '@mastra/playground-ui/domains/traces/types';
import { useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

/**
 * Expanded node ids for a span tree. Everything is expanded by default; user toggles are stored
 * separately so the default is derived from the data rather than synced with an effect.
 */
export function useExpandedSpanIds(hierarchicalSpans: UISpan[]) {
  const allSpanIds = useMemo(() => getAllSpanIds(hierarchicalSpans), [hierarchicalSpans]);
  const [userExpandedSpanIds, setUserExpandedSpanIds] = useState<string[] | null>(null);

  const expandedSpanIds = userExpandedSpanIds ?? allSpanIds;
  const setExpandedSpanIds: Dispatch<SetStateAction<string[]>> = update =>
    setUserExpandedSpanIds(current => (typeof update === 'function' ? update(current ?? allSpanIds) : update));

  return { expandedSpanIds, setExpandedSpanIds };
}
