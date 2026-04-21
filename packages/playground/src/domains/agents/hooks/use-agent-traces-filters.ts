import type { TraceStatus } from '@internal-temp/core/index';
import { EntityType } from '@mastra/core/observability';
import { useState, useCallback, useMemo } from 'react';

export type AgentTracesFilterState = {
  search: string;
  status: TraceStatus | 'all';
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  scorerId: string | undefined;
  scoreThreshold: number | undefined;
};

const INITIAL_FILTERS: AgentTracesFilterState = {
  search: '',
  status: 'all',
  dateFrom: undefined,
  dateTo: undefined,
  scorerId: undefined,
  scoreThreshold: undefined,
};

export function useAgentTracesFilters(agentId: string) {
  const [search, setSearch] = useState(INITIAL_FILTERS.search);
  const [status, setStatus] = useState<TraceStatus | 'all'>(INITIAL_FILTERS.status);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(INITIAL_FILTERS.dateFrom);
  const [dateTo, setDateTo] = useState<Date | undefined>(INITIAL_FILTERS.dateTo);
  const [scorerId, setScorerId] = useState<string | undefined>(INITIAL_FILTERS.scorerId);
  const [scoreThreshold, setScoreThreshold] = useState<number | undefined>(INITIAL_FILTERS.scoreThreshold);
  const [resetKey, setResetKey] = useState(0);

  // Server-side filters for the listTraces API
  const apiFilters = useMemo(
    () => ({
      entityId: agentId,
      entityType: EntityType.AGENT,
      ...(status !== 'all' && { status }),
      ...((dateFrom || dateTo) && {
        startedAt: {
          ...(dateFrom && { start: dateFrom }),
          ...(dateTo && { end: dateTo }),
        },
      }),
    }),
    [agentId, status, dateFrom, dateTo],
  );

  const filtersApplied = Boolean(
    search || status !== 'all' || dateFrom || dateTo || scorerId || scoreThreshold !== undefined,
  );

  const resetFilters = useCallback(() => {
    setSearch(INITIAL_FILTERS.search);
    setStatus(INITIAL_FILTERS.status);
    setDateFrom(INITIAL_FILTERS.dateFrom);
    setDateTo(INITIAL_FILTERS.dateTo);
    setScorerId(INITIAL_FILTERS.scorerId);
    setScoreThreshold(INITIAL_FILTERS.scoreThreshold);
    setResetKey(k => k + 1);
  }, []);

  return {
    // Filter values
    search,
    status,
    dateFrom,
    dateTo,
    scorerId,
    scoreThreshold,

    // Setters
    setSearch,
    setStatus,
    setDateFrom,
    setDateTo,
    setScorerId,
    setScoreThreshold,

    // Computed
    apiFilters,
    filtersApplied,
    resetFilters,
    resetKey,
  };
}
