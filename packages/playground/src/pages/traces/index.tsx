import { EntityType } from '@mastra/core/observability';
import {
  ButtonWithTooltip,
  ErrorState,
  NoDataPageLayout,
  PageHeader,
  PageLayout,
  PermissionDenied,
  SessionExpired,
  is401UnauthorizedError,
  is403ForbiddenError,
  parseError,
} from '@mastra/playground-ui';
import { BookIcon, EyeIcon } from 'lucide-react';
import { useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useAgents } from '@/domains/agents/hooks/use-agents';
import { useEnvironments } from '@/domains/observability/hooks/use-environments';
import { useServiceNames } from '@/domains/observability/hooks/use-service-names';
import { useTags } from '@/domains/observability/hooks/use-tags';
import { useTraces } from '@/domains/observability/hooks/use-traces';
import { ObservabilityTracesList } from '@/domains/traces/components/observability-traces-list';
import type { SpanTab } from '@/domains/traces/components/observability-traces-list';
import { TracesToolbar } from '@/domains/traces/components/traces-toolbar';
import { CONTEXT_FIELD_IDS } from '@/domains/traces/types';
import type { EntityOptions, TraceDatePreset } from '@/domains/traces/types';
import { useWorkflows } from '@/domains/workflows/hooks/use-workflows';

export default function Traces() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedEntityOption, setSelectedEntityOption] = useState<EntityOptions | undefined>({
    value: 'all',
    label: 'All',
    type: 'all' as const,
  });
  const [selectedDateFrom, setSelectedDateFrom] = useState<Date | undefined>(
    () => new Date(Date.now() - 24 * 60 * 60 * 1000),
  );
  const [selectedDateTo, setSelectedDateTo] = useState<Date | undefined>(undefined);
  const [groupByThread, setGroupByThread] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [errorOnly, setErrorOnly] = useState<boolean>(false);
  const [selectedMetadata, setSelectedMetadata] = useState<Record<string, string>>({});
  const [datePreset, setDatePreset] = useState<TraceDatePreset>('last-24h');
  const [contextFilters, setContextFilters] = useState<Record<string, string>>({});
  const { data: agents = {}, isLoading: isLoadingAgents } = useAgents();
  const { data: workflows, isLoading: isLoadingWorkflows } = useWorkflows();
  const { data: availableTags = [] } = useTags();
  const { data: discoveredEnvironments = [] } = useEnvironments();
  const { data: discoveredServiceNames = [] } = useServiceNames();

  // Read deep-link params
  const traceIdParam = searchParams.get('traceId') || undefined;
  const spanIdParam = searchParams.get('spanId') || undefined;
  const tabParam = searchParams.get('tab');
  const spanTabParam: SpanTab | undefined =
    tabParam === 'scoring' ? 'scoring' : tabParam === 'details' ? 'details' : undefined;
  const scoreIdParam = searchParams.get('scoreId') || undefined;

  const handleTraceClick = useCallback(
    (traceId: string) => {
      const params: Record<string, string> = {};
      const entity = searchParams.get('entity');
      if (entity) params.entity = entity;
      if (traceId) {
        params.traceId = traceId;
      }
      setSearchParams(params);
    },
    [searchParams, setSearchParams],
  );

  const handleSpanChange = useCallback(
    (spanId: string | null) => {
      // Skip if the URL already matches to avoid unnecessary updates
      const currentSpanId = searchParams.get('spanId') || null;
      if (spanId === currentSpanId) return;

      const params: Record<string, string> = {};
      const entity = searchParams.get('entity');
      if (entity) params.entity = entity;
      const traceId = searchParams.get('traceId');
      if (traceId) params.traceId = traceId;
      if (spanId) {
        params.spanId = spanId;
      }
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const buildParams = useCallback(() => {
    const params: Record<string, string> = {};
    const entity = searchParams.get('entity');
    if (entity) params.entity = entity;
    const traceId = searchParams.get('traceId');
    if (traceId) params.traceId = traceId;
    const spanId = searchParams.get('spanId');
    if (spanId) params.spanId = spanId;
    const tab = searchParams.get('tab');
    if (tab) params.tab = tab;
    const scoreId = searchParams.get('scoreId');
    if (scoreId) params.scoreId = scoreId;
    return params;
  }, [searchParams]);

  const handleSpanTabChange = useCallback(
    (tab: SpanTab) => {
      const currentTab = searchParams.get('tab') || null;
      if (tab === currentTab) return;

      const params = buildParams();
      if (tab && tab !== 'details') {
        params.tab = tab;
      } else {
        delete params.tab;
      }
      delete params.scoreId;
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams, buildParams],
  );

  const handleScoreChange = useCallback(
    (scoreId: string | null) => {
      const currentScoreId = searchParams.get('scoreId') || null;
      if (scoreId === currentScoreId) return;

      const params = buildParams();
      if (scoreId) {
        params.scoreId = scoreId;
      } else {
        delete params.scoreId;
      }
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams, buildParams],
  );

  const metadataFilterObj = useMemo(() => {
    if (Object.keys(selectedMetadata).length === 0) return undefined;
    return selectedMetadata;
  }, [selectedMetadata]);

  const {
    data: tracesData,
    isLoading: isTracesLoading,
    isFetchingNextPage,
    hasNextPage,
    setEndOfListElement,
    error: TracesError,
    isError: isTracesError,
  } = useTraces({
    filters: {
      ...(selectedEntityOption?.type !== 'all' && {
        entityId: selectedEntityOption?.value,
        entityType: selectedEntityOption?.type,
      }),
      ...(selectedDateFrom && {
        startedAt: {
          start: selectedDateFrom,
        },
      }),
      ...(selectedDateTo && {
        endedAt: {
          end: selectedDateTo,
        },
      }),
      ...(selectedTags.length > 0 && { tags: selectedTags }),
      ...(errorOnly && { status: 'error' }),
      ...(metadataFilterObj && { metadata: metadataFilterObj }),
      ...Object.fromEntries(Object.entries(contextFilters).filter(([, v]) => v.trim())),
    },
  });

  const allTraces = useMemo(() => tracesData?.spans ?? [], [tracesData?.spans]);
  const threadTitles = tracesData?.threadTitles ?? {};

  const deferredSearchQuery = useDeferredValue(searchQuery);
  const traces = useMemo(() => {
    if (!deferredSearchQuery.trim()) return allTraces;
    const q = deferredSearchQuery.trim().toLowerCase();
    return allTraces.filter(t => {
      if (t.traceId?.toLowerCase().includes(q)) return true;
      if (t.name?.toLowerCase().includes(q)) return true;
      if (t.entityId?.toLowerCase().includes(q)) return true;
      if (t.entityName?.toLowerCase().includes(q)) return true;
      if (t.input != null) {
        const inputStr = typeof t.input === 'string' ? t.input : JSON.stringify(t.input);
        if (inputStr.toLowerCase().includes(q)) return true;
      }
      const meta = t.metadata;
      if (meta && typeof meta === 'object') {
        for (const val of Object.values(meta)) {
          if (String(val).toLowerCase().includes(q)) return true;
        }
      }
      return false;
    });
  }, [allTraces, deferredSearchQuery]);

  // Accumulate available metadata keys/values across all loaded trace batches.
  const metadataAccRef = useRef<Record<string, Set<string>>>({});
  const prevMetadataResultRef = useRef<Record<string, string[]>>({});

  const availableMetadata = useMemo(() => {
    let changed = false;
    const acc = metadataAccRef.current;
    for (const trace of allTraces) {
      const meta = trace.metadata;
      if (meta && typeof meta === 'object') {
        for (const [key, value] of Object.entries(meta)) {
          if (value == null) continue;
          if (!acc[key]) {
            acc[key] = new Set();
            changed = true;
          }
          const str = String(value);
          if (!acc[key].has(str)) {
            acc[key].add(str);
            changed = true;
          }
        }
      }
    }
    if (!changed) return prevMetadataResultRef.current;
    const result = Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, [...v].sort()]));
    prevMetadataResultRef.current = result;
    return result;
  }, [allTraces]);

  const contextAccRef = useRef<Record<string, Set<string>>>({});
  const prevContextResultRef = useRef<Record<string, string[]>>({});

  const availableContextValues = useMemo(() => {
    let changed = false;
    const acc = contextAccRef.current;
    for (const trace of allTraces) {
      for (const field of CONTEXT_FIELD_IDS) {
        const value = trace[field];
        if (value != null && typeof value === 'string' && value.trim()) {
          if (!acc[field]) {
            acc[field] = new Set();
            changed = true;
          }
          if (!acc[field].has(value)) {
            acc[field].add(value);
            changed = true;
          }
        }
      }
    }
    for (const env of discoveredEnvironments) {
      if (!acc['environment']) {
        acc['environment'] = new Set();
        changed = true;
      }
      if (!acc['environment'].has(env)) {
        acc['environment'].add(env);
        changed = true;
      }
    }
    for (const sn of discoveredServiceNames) {
      if (!acc['serviceName']) {
        acc['serviceName'] = new Set();
        changed = true;
      }
      if (!acc['serviceName'].has(sn)) {
        acc['serviceName'].add(sn);
        changed = true;
      }
    }
    if (!changed) return prevContextResultRef.current;
    const result = Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, [...v].sort()]));
    prevContextResultRef.current = result;
    return result;
  }, [allTraces, discoveredEnvironments, discoveredServiceNames]);

  const agentOptions: EntityOptions[] = useMemo(
    () =>
      (Object.entries(agents) || []).map(([_, value]) => ({
        value: value.id,
        label: value.name,
        type: EntityType.AGENT,
      })),
    [agents],
  );

  const workflowOptions: EntityOptions[] = useMemo(
    () =>
      (Object.entries(workflows || {}) || []).map(([, value]) => ({
        value: value.name,
        label: value.name,
        type: EntityType.WORKFLOW_RUN,
      })),
    [workflows],
  );

  const entityOptions: EntityOptions[] = useMemo(
    () => [{ value: 'all', label: 'All', type: 'all' as const }, ...agentOptions, ...workflowOptions],
    [agentOptions, workflowOptions],
  );

  // Sync URL entity to state
  const entityName = searchParams.get('entity');
  const matchedEntityOption = entityOptions.find(option => option.value === entityName);
  if (matchedEntityOption && matchedEntityOption.value !== selectedEntityOption?.value) {
    setSelectedEntityOption(matchedEntityOption);
  }

  const handleReset = () => {
    setSearchParams({ entity: 'all' }, { replace: true });
    setSelectedDateFrom(new Date(Date.now() - 24 * 60 * 60 * 1000));
    setSelectedDateTo(undefined);
    setGroupByThread(false);
    setSearchQuery('');
    setSelectedTags([]);
    setErrorOnly(false);
    setSelectedMetadata({});
    setDatePreset('last-24h');
    setContextFilters({});
    metadataAccRef.current = {};
    prevMetadataResultRef.current = {};
    contextAccRef.current = {};
    prevContextResultRef.current = {};
  };

  const handleDataChange = (value: Date | undefined, type: 'from' | 'to') => {
    if (type === 'from') {
      return setSelectedDateFrom(value);
    }
    setSelectedDateTo(value);
  };

  const handleSelectedEntityChange = (option: EntityOptions | undefined) => {
    if (option?.value) setSearchParams({ entity: option.value });
  };

  const error = isTracesError ? parseError(TracesError) : undefined;

  // 401 check - session expired
  if (TracesError && is401UnauthorizedError(TracesError)) {
    return (
      <NoDataPageLayout title="Traces" icon={<EyeIcon />}>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  // 403 check
  if (TracesError && is403ForbiddenError(TracesError)) {
    return (
      <NoDataPageLayout title="Traces" icon={<EyeIcon />}>
        <PermissionDenied resource="traces" />
      </NoDataPageLayout>
    );
  }

  if (TracesError) {
    return (
      <NoDataPageLayout title="Traces" icon={<EyeIcon />}>
        <ErrorState title="Failed to load traces" message={error?.error ?? 'Unknown error'} />
      </NoDataPageLayout>
    );
  }

  const filtersApplied =
    selectedEntityOption?.value !== 'all' ||
    datePreset !== 'last-24h' ||
    selectedDateTo ||
    searchQuery.trim() ||
    selectedTags.length > 0 ||
    errorOnly ||
    Object.keys(selectedMetadata).length > 0 ||
    Object.values(contextFilters).some(v => v.trim());

  return (
    <PageLayout width="wide" height="full">
      <PageLayout.TopArea>
        <PageLayout.Row>
          <PageLayout.Column>
            <PageHeader>
              <PageHeader.Title isLoading={isTracesLoading}>
                <EyeIcon /> Traces
              </PageHeader.Title>
            </PageHeader>
          </PageLayout.Column>
          <PageLayout.Column className="flex justify-end gap-2">
            <ButtonWithTooltip
              as="a"
              href="https://mastra.ai/en/docs/observability/tracing/overview"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Traces documentation"
              tooltipContent="Go to Traces documentation"
            >
              <BookIcon />
            </ButtonWithTooltip>
          </PageLayout.Column>
        </PageLayout.Row>

        <TracesToolbar
          onEntityChange={handleSelectedEntityChange}
          onReset={handleReset}
          selectedEntity={selectedEntityOption}
          entityOptions={entityOptions}
          onDateChange={handleDataChange}
          selectedDateFrom={selectedDateFrom}
          selectedDateTo={selectedDateTo}
          isLoading={isTracesLoading || isLoadingAgents || isLoadingWorkflows}
          groupByThread={groupByThread}
          onGroupByThreadChange={setGroupByThread}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedTags={selectedTags}
          availableTags={availableTags}
          onTagsChange={setSelectedTags}
          errorOnly={errorOnly}
          onErrorOnlyChange={setErrorOnly}
          selectedMetadata={selectedMetadata}
          availableMetadata={availableMetadata}
          onMetadataChange={setSelectedMetadata}
          datePreset={datePreset}
          onDatePresetChange={setDatePreset}
          contextFilters={contextFilters}
          availableContextValues={availableContextValues}
          onContextFiltersChange={setContextFilters}
        />
      </PageLayout.TopArea>

      <ObservabilityTracesList
        traces={traces}
        isLoading={isTracesLoading}
        isFetchingNextPage={isFetchingNextPage}
        hasNextPage={hasNextPage}
        setEndOfListElement={setEndOfListElement}
        filtersApplied={Boolean(filtersApplied)}
        selectedTraceId={traceIdParam}
        initialSpanId={spanIdParam}
        initialSpanTab={spanTabParam}
        initialScoreId={scoreIdParam}
        onTraceClick={handleTraceClick}
        onSpanChange={handleSpanChange}
        onSpanTabChange={handleSpanTabChange}
        onScoreChange={handleScoreChange}
        groupByThread={groupByThread}
        threadTitles={threadTitles}
      />
    </PageLayout>
  );
}
