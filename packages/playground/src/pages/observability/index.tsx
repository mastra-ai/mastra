import { EntityType } from '@mastra/core/observability';
import {
  ButtonWithTooltip,
  EntityListPageLayout,
  EntryListSkeleton,
  MainHeader,
  PermissionDenied,
  SessionExpired,
  getToNextEntryFn,
  getToPreviousEntryFn,
  is401UnauthorizedError,
  is403ForbiddenError,
  parseError,
} from '@mastra/playground-ui';
import { BookIcon, EyeIcon } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useAgents } from '@/domains/agents/hooks/use-agents';
import { TraceDialog } from '@/domains/observability/components/trace-dialog';
import { TracesList, tracesListColumns } from '@/domains/observability/components/traces-list';
import { TracesTools } from '@/domains/observability/components/traces-tools';
import { useEnvironments } from '@/domains/observability/hooks/use-environments';
import { useServiceNames } from '@/domains/observability/hooks/use-service-names';
import { useTags } from '@/domains/observability/hooks/use-tags';
import { useTrace } from '@/domains/observability/hooks/use-trace';
import { useTraces } from '@/domains/observability/hooks/use-traces';
import { useScorers } from '@/domains/scores';
import { CONTEXT_FIELD_IDS } from '@/domains/traces/types';
import type { EntityOptions, TraceDatePreset } from '@/domains/traces/types';
import { groupTracesByThread } from '@/domains/traces/utils/group-traces-by-thread';
import { useWorkflows } from '@/domains/workflows/hooks/use-workflows';

export default function Observability() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTraceId, setSelectedTraceId] = useState<string | undefined>();
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
  const [dialogIsOpen, setDialogIsOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [errorOnly, setErrorOnly] = useState<boolean>(false);
  const [selectedMetadata, setSelectedMetadata] = useState<Record<string, string>>({});
  const [datePreset, setDatePreset] = useState<TraceDatePreset>('last-24h');
  const [contextFilters, setContextFilters] = useState<Record<string, string>>({});
  const { data: agents = {}, isLoading: isLoadingAgents } = useAgents();
  const { data: workflows, isLoading: isLoadingWorkflows } = useWorkflows();
  const { data: scorers = {}, isLoading: isLoadingScorers } = useScorers();
  const { data: availableTags = [] } = useTags();
  const { data: discoveredEnvironments = [] } = useEnvironments();
  const { data: discoveredServiceNames = [] } = useServiceNames();

  const { data: Trace, isLoading: isLoadingTrace } = useTrace(selectedTraceId, { enabled: !!selectedTraceId });

  const traceId = searchParams.get('traceId');
  const spanId = searchParams.get('spanId');
  const spanTab = searchParams.get('tab');
  const scoreId = searchParams.get('scoreId');

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

  const deferredSearchQuery = useDeferredValue(searchQuery);
  const traces = useMemo(() => {
    if (!deferredSearchQuery.trim()) return allTraces;
    const q = deferredSearchQuery.trim().toLowerCase();
    return allTraces.filter(t => {
      if (t.traceId?.toLowerCase().includes(q)) return true;
      if (t.name?.toLowerCase().includes(q)) return true;
      if (t.entityId?.toLowerCase().includes(q)) return true;
      if (t.entityName?.toLowerCase().includes(q)) return true;
      const meta = t.metadata;
      if (meta && typeof meta === 'object') {
        for (const val of Object.values(meta)) {
          if (String(val).toLowerCase().includes(q)) return true;
        }
      }
      return false;
    });
  }, [allTraces, deferredSearchQuery]);
  const threadTitles = tracesData?.threadTitles ?? {};

  // Accumulate available metadata keys/values across all loaded trace batches.
  // Values only grow (never shrink when filters narrow results) so pickers stay populated.
  // Uses useRef + useMemo to avoid the extra render cycle that useEffect+useState causes.
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
    // Merge in discovery API results
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

  useEffect(() => {
    if (traceId) {
      if (traceId !== selectedTraceId) {
        setSelectedTraceId(traceId);
      }
      setDialogIsOpen(true);
      return;
    }

    if (selectedTraceId) {
      setSelectedTraceId(undefined);
    }

    if (dialogIsOpen) {
      setDialogIsOpen(false);
    }
  }, [dialogIsOpen, selectedTraceId, traceId]);

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
    setSelectedTraceId(undefined);
    setSearchParams({ entity: 'all', traceId: '' });
    setDialogIsOpen(false);
    setSelectedDateFrom(undefined);
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

  const handleTraceClick = (id: string) => {
    if (id === selectedTraceId) {
      void navigate('/observability');
      return;
    }

    void navigate(`/observability?traceId=${encodeURIComponent(id)}`);
  };

  const error = isTracesError ? parseError(TracesError) : undefined;

  const orderedTraceEntries = useMemo(() => {
    if (!groupByThread) {
      return traces.map(item => ({ id: item.traceId }));
    }
    const { groups, ungrouped } = groupTracesByThread(traces);
    const ordered: { id: string }[] = [];
    for (const group of groups) {
      for (const trace of group.traces) {
        ordered.push({ id: trace.traceId });
      }
    }
    for (const trace of ungrouped) {
      ordered.push({ id: trace.traceId });
    }
    return ordered;
  }, [traces, groupByThread]);

  // 401 check - session expired, needs re-authentication
  if (TracesError && is401UnauthorizedError(TracesError)) {
    return (
      <EntityListPageLayout>
        <EntityListPageLayout.Top>
          <MainHeader withMargins={false}>
            <MainHeader.Column>
              <MainHeader.Title>
                <EyeIcon /> Observability
              </MainHeader.Title>
              <MainHeader.Description>Explore observability traces for your entities</MainHeader.Description>
            </MainHeader.Column>
            <MainHeader.Column className="flex justify-end gap-2">
              <ButtonWithTooltip
                as="a"
                href="https://mastra.ai/en/docs/observability/tracing/overview"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Observability documentation"
                tooltipContent="Go to Observability documentation"
              >
                <BookIcon />
              </ButtonWithTooltip>
            </MainHeader.Column>
          </MainHeader>
        </EntityListPageLayout.Top>
        <div className="flex h-full items-center justify-center">
          <SessionExpired />
        </div>
      </EntityListPageLayout>
    );
  }

  // 403 check - permission denied for traces
  if (TracesError && is403ForbiddenError(TracesError)) {
    return (
      <EntityListPageLayout>
        <EntityListPageLayout.Top>
          <MainHeader withMargins={false}>
            <MainHeader.Column>
              <MainHeader.Title>
                <EyeIcon /> Observability
              </MainHeader.Title>
              <MainHeader.Description>Explore observability traces for your entities</MainHeader.Description>
            </MainHeader.Column>
            <MainHeader.Column className="flex justify-end gap-2">
              <ButtonWithTooltip
                as="a"
                href="https://mastra.ai/en/docs/observability/tracing/overview"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Observability documentation"
                tooltipContent="Go to Observability documentation"
              >
                <BookIcon />
              </ButtonWithTooltip>
            </MainHeader.Column>
          </MainHeader>
        </EntityListPageLayout.Top>
        <div className="flex h-full items-center justify-center">
          <PermissionDenied resource="traces" />
        </div>
      </EntityListPageLayout>
    );
  }

  const filtersApplied =
    selectedEntityOption?.value !== 'all' ||
    selectedDateFrom ||
    selectedDateTo ||
    searchQuery.trim() ||
    selectedTags.length > 0 ||
    errorOnly ||
    Object.keys(selectedMetadata).length > 0 ||
    Object.values(contextFilters).some(v => v.trim());

  const toNextTrace = getToNextEntryFn({
    entries: orderedTraceEntries,
    id: selectedTraceId,
    update: setSelectedTraceId,
  });
  const toPreviousTrace = getToPreviousEntryFn({
    entries: orderedTraceEntries,
    id: selectedTraceId,
    update: setSelectedTraceId,
  });

  return (
    <>
      <EntityListPageLayout className="grid-rows-[auto_1fr] overflow-y-auto">
        <EntityListPageLayout.Top>
          <MainHeader withMargins={false}>
            <MainHeader.Column>
              <MainHeader.Title isLoading={isTracesLoading}>
                <EyeIcon /> Observability
              </MainHeader.Title>
              <MainHeader.Description>Explore observability traces for your entities</MainHeader.Description>
            </MainHeader.Column>
            <MainHeader.Column className="flex justify-end gap-2">
              <ButtonWithTooltip
                as="a"
                href="https://mastra.ai/en/docs/observability/tracing/overview"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Observability documentation"
                tooltipContent="Go to Observability documentation"
              >
                <BookIcon />
              </ButtonWithTooltip>
            </MainHeader.Column>
          </MainHeader>

          <TracesTools
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
        </EntityListPageLayout.Top>

        {isTracesLoading ? (
          <EntryListSkeleton columns={tracesListColumns} />
        ) : (
          <TracesList
            traces={traces}
            selectedTraceId={selectedTraceId}
            onTraceClick={handleTraceClick}
            errorMsg={error?.error}
            setEndOfListElement={setEndOfListElement}
            filtersApplied={Boolean(filtersApplied)}
            isFetchingNextPage={isFetchingNextPage}
            hasNextPage={hasNextPage}
            groupByThread={groupByThread}
            threadTitles={threadTitles}
          />
        )}
      </EntityListPageLayout>
      <TraceDialog
        traceSpans={Trace?.spans}
        traceId={selectedTraceId}
        initialSpanId={spanId || undefined}
        initialSpanTab={spanTab === 'scores' ? 'scores' : 'details'}
        initialScoreId={scoreId || undefined}
        traceDetails={traces.find(t => t.traceId === selectedTraceId)}
        isOpen={dialogIsOpen}
        onClose={() => {
          void navigate(`/observability`);
          setDialogIsOpen(false);
        }}
        onNext={toNextTrace}
        onPrevious={toPreviousTrace}
        isLoadingSpans={isLoadingTrace}
        computeTraceLink={(traceId, spanId) => `/observability?traceId=${traceId}${spanId ? `&spanId=${spanId}` : ''}`}
        scorers={scorers}
        isLoadingScorers={isLoadingScorers}
      />
    </>
  );
}
