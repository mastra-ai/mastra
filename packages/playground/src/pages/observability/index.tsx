import { EntityType } from '@mastra/core/observability';
import type { EntityOptions, DatePreset } from '@mastra/playground-ui';
import {
  HeaderTitle,
  Header,
  MainContentLayout,
  TracesList,
  tracesListColumns,
  PageHeader,
  TracesTools,
  TraceDialog,
  parseError,
  Icon,
  HeaderAction,
  Button,
  DocsIcon,
  EntryListSkeleton,
  getToNextEntryFn,
  getToPreviousEntryFn,
  groupTracesByThread,
  useAgents,
  useWorkflows,
  useScorers,
  useTags,
  useEnvironments,
  useServiceNames,
  PermissionDenied,
  is403ForbiddenError,
} from '@mastra/playground-ui';

import { EyeIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useTrace } from '@/domains/observability/hooks/use-trace';
import { useTraces } from '@/domains/observability/hooks/use-traces';

import { cn } from '@/lib/utils';

/** Context field IDs that we extract distinct values from on loaded traces */
const CONTEXT_FIELD_IDS = [
  'environment',
  'serviceName',
  'source',
  'userId',
  'organizationId',
  'resourceId',
  'runId',
  'sessionId',
  'threadId',
  'requestId',
  'experimentId',
  'spanType',
  'entityName',
  'parentEntityType',
  'parentEntityId',
  'parentEntityName',
  'rootEntityType',
  'rootEntityId',
  'rootEntityName',
] as const;

export default function Observability() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTraceId, setSelectedTraceId] = useState<string | undefined>();
  const [selectedEntityOption, setSelectedEntityOption] = useState<EntityOptions | undefined>({
    value: 'all',
    label: 'All',
    type: 'all' as const,
  });
  const [selectedDateFrom, setSelectedDateFrom] = useState<Date | undefined>(undefined);
  const [selectedDateTo, setSelectedDateTo] = useState<Date | undefined>(undefined);
  const [groupByThread, setGroupByThread] = useState<boolean>(false);
  const [dialogIsOpen, setDialogIsOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [errorOnly, setErrorOnly] = useState<boolean>(false);
  const [selectedMetadata, setSelectedMetadata] = useState<Record<string, string>>({});
  const [datePreset, setDatePreset] = useState<DatePreset>('last-24h');
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

  const traces = useMemo(() => {
    if (!searchQuery.trim()) return allTraces;
    const q = searchQuery.trim().toLowerCase();
    return allTraces.filter(t => {
      if (t.name?.toLowerCase().includes(q)) return true;
      if (t.entityId?.toLowerCase().includes(q)) return true;
      if (t.entityName?.toLowerCase().includes(q)) return true;
      const meta = (t as any).metadata;
      if (meta && typeof meta === 'object') {
        for (const val of Object.values(meta)) {
          if (String(val).toLowerCase().includes(q)) return true;
        }
      }
      return false;
    });
  }, [allTraces, searchQuery]);
  const threadTitles = tracesData?.threadTitles ?? {};

  // Accumulate available metadata keys/values across all loaded trace batches.
  // Values only grow (never shrink when filters narrow results) so pickers stay populated.
  const [availableMetadata, setAvailableMetadata] = useState<Record<string, string[]>>({});
  const [availableContextValues, setAvailableContextValues] = useState<Record<string, string[]>>({});

  useEffect(() => {
    setAvailableMetadata(prev => {
      let changed = false;
      const next: Record<string, Set<string>> = {};
      for (const [k, v] of Object.entries(prev)) next[k] = new Set(v);
      for (const trace of allTraces) {
        const meta = (trace as any).metadata;
        if (meta && typeof meta === 'object') {
          for (const [key, value] of Object.entries(meta)) {
            if (value == null) continue;
            if (!next[key]) {
              next[key] = new Set();
              changed = true;
            }
            const str = String(value);
            if (!next[key].has(str)) {
              next[key].add(str);
              changed = true;
            }
          }
        }
      }
      if (!changed) return prev;
      return Object.fromEntries(Object.entries(next).map(([k, v]) => [k, [...v].sort()]));
    });
  }, [allTraces]);

  useEffect(() => {
    setAvailableContextValues(prev => {
      let changed = false;
      const next: Record<string, Set<string>> = {};
      for (const [k, v] of Object.entries(prev)) next[k] = new Set(v);
      for (const trace of allTraces) {
        for (const field of CONTEXT_FIELD_IDS) {
          const value = (trace as any)[field];
          if (value != null && typeof value === 'string' && value.trim()) {
            if (!next[field]) {
              next[field] = new Set();
              changed = true;
            }
            if (!next[field].has(value)) {
              next[field].add(value);
              changed = true;
            }
          }
        }
      }
      // Merge in discovery API results
      for (const env of discoveredEnvironments) {
        if (!next['environment']) {
          next['environment'] = new Set();
          changed = true;
        }
        if (!next['environment'].has(env)) {
          next['environment'].add(env);
          changed = true;
        }
      }
      for (const sn of discoveredServiceNames) {
        if (!next['serviceName']) {
          next['serviceName'] = new Set();
          changed = true;
        }
        if (!next['serviceName'].has(sn)) {
          next['serviceName'].add(sn);
          changed = true;
        }
      }
      if (!changed) return prev;
      return Object.fromEntries(Object.entries(next).map(([k, v]) => [k, [...v].sort()]));
    });
  }, [allTraces, discoveredEnvironments, discoveredServiceNames]);

  // Sync URL traceId to state
  if (traceId && traceId !== selectedTraceId) {
    setSelectedTraceId(traceId);
    setDialogIsOpen(true);
  }

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
    setAvailableMetadata({});
    setAvailableContextValues({});
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
      return setSelectedTraceId(undefined);
    }
    setSelectedTraceId(id);
    setDialogIsOpen(true);
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

  // 403 check - permission denied for traces
  if (TracesError && is403ForbiddenError(TracesError)) {
    return (
      <MainContentLayout>
        <Header>
          <HeaderTitle>
            <Icon>
              <EyeIcon />
            </Icon>
            Observability
          </HeaderTitle>

          <HeaderAction>
            <Button
              as={Link}
              to="https://mastra.ai/en/docs/observability/tracing/overview"
              target="_blank"
              variant="ghost"
              size="md"
            >
              <DocsIcon />
              Observability documentation
            </Button>
          </HeaderAction>
        </Header>

        <div className="flex h-full items-center justify-center">
          <PermissionDenied resource="traces" />
        </div>
      </MainContentLayout>
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
      <MainContentLayout>
        <Header>
          <HeaderTitle>
            <Icon>
              <EyeIcon />
            </Icon>
            Observability
          </HeaderTitle>

          <HeaderAction>
            <Button
              as={Link}
              to="https://mastra.ai/en/docs/observability/tracing/overview"
              target="_blank"
              variant="ghost"
              size="md"
            >
              <DocsIcon />
              Observability documentation
            </Button>
          </HeaderAction>
        </Header>

        <div className={cn(`grid overflow-y-scroll h-full`)}>
          <div className={cn('w-full max-w-[100rem] px-12 mx-auto grid grid-rows-[auto_auto_1fr] gap-8 h-full')}>
            <PageHeader
              title="Observability"
              description="Explore observability traces for your entities"
              icon={<EyeIcon />}
            />

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
          </div>
        </div>
      </MainContentLayout>
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
