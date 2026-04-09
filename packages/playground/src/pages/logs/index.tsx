import type { EntityType } from '@mastra/core/observability';
import type { LogRecord, FeaturedIds, LogsDatePreset } from '@mastra/playground-ui';
import {
  MainHeader,
  LogsList,
  LogsToolbar,
  ROOT_ENTITY_TYPE_OPTIONS,
  isValidLogsDatePreset,
  useEntityNames,
  useLogsFilters,
  EntityListPageLayout,
  PermissionDenied,
  SessionExpired,
  is403ForbiddenError,
  is401UnauthorizedError,
} from '@mastra/playground-ui';
import { LogsIcon } from 'lucide-react';
import { useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { useLogs } from '@/domains/logs/hooks/use-logs';

const PERIOD_PARAM = 'period';
const LOG_PARAM = 'logId';
const TRACE_PARAM = 'traceId';
const SPAN_PARAM = 'spanId';
const ENTITY_TYPE_PARAM = 'entityType';
const ENTITY_NAME_PARAM = 'entityName';
const ROOT_ENTITY_TYPE_PARAM = 'rootEntityType';
const ROOT_ENTITY_NAME_PARAM = 'rootEntityName';

const PRESET_TO_MS: Record<LogsDatePreset, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '3d': 3 * 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '14d': 14 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

export default function Logs() {
  const [searchParams, setSearchParams] = useSearchParams();

  const urlPreset = searchParams.get(PERIOD_PARAM);
  const datePreset = isValidLogsDatePreset(urlPreset) ? urlPreset : '24h';

  const featuredLogId = searchParams.get(LOG_PARAM);
  const featuredTraceId = searchParams.get(TRACE_PARAM);
  const featuredSpanId = searchParams.get(SPAN_PARAM);
  const selectedEntityType = searchParams.get(ENTITY_TYPE_PARAM) ?? undefined;
  const selectedEntityName = searchParams.get(ENTITY_NAME_PARAM) ?? undefined;
  const selectedRootEntityType = ROOT_ENTITY_TYPE_OPTIONS.find(
    option => option.entityType === searchParams.get(ROOT_ENTITY_TYPE_PARAM),
  );
  const selectedRootEntityName = searchParams.get(ROOT_ENTITY_NAME_PARAM) ?? undefined;
  const { data: entityNameOptions = [] } = useEntityNames({ entityType: selectedEntityType as EntityType | undefined });
  const { data: rootEntityNameOptions = [] } = useEntityNames({
    entityType: selectedRootEntityType?.entityType,
    rootOnly: true,
  });

  const handleTimePeriodChange = useCallback(
    (preset: LogsDatePreset) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (preset === '24h') {
            next.delete(PERIOD_PARAM);
          } else {
            next.set(PERIOD_PARAM, preset);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handleFeaturedChange = useCallback(
    (ids: FeaturedIds) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          for (const [field, value] of Object.entries(ids)) {
            const param = field === 'logId' ? LOG_PARAM : field === 'traceId' ? TRACE_PARAM : SPAN_PARAM;
            if (value) {
              next.set(param, value);
            } else {
              next.delete(param);
            }
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const logsFilters = useMemo(() => {
    const ms = PRESET_TO_MS[datePreset];
    if (!ms) return undefined;
    return {
      timestamp: { start: new Date(Date.now() - ms) },
      ...(selectedEntityType && { entityType: selectedEntityType }),
      ...(selectedEntityName && { entityName: selectedEntityName }),
      ...(selectedRootEntityType && { rootEntityType: selectedRootEntityType.entityType }),
      ...(selectedRootEntityName && { rootEntityName: selectedRootEntityName }),
    };
  }, [datePreset, selectedEntityName, selectedEntityType, selectedRootEntityName, selectedRootEntityType]);

  const {
    data: logs = [],
    isLoading: isLoadingLogs,
    error: logsError,
    isFetchingNextPage,
    hasNextPage,
    setEndOfListElement,
  } = useLogs({ filters: logsFilters });

  const {
    searchQuery,
    setSearchQuery,
    filterGroups,
    filterColumns,
    toggleComparator,
    removeFilterGroup,
    clearAllFilters,
    updateFilterGroups,
    filteredLogs,
  } = useLogsFilters(logs as LogRecord[]);

  const entityTypeOptions = useMemo(() => {
    const uniqueEntityTypes = Array.from(new Set(logs.map(log => log.entityType).filter(Boolean))) as string[];
    return uniqueEntityTypes.sort().map(entityType => ({
      entityType,
      label:
        entityType === 'workflow_run'
          ? 'Workflow'
          : entityType === 'rag_ingestion'
            ? 'Ingest'
            : entityType
                .split('_')
                .map(part => part.charAt(0).toUpperCase() + part.slice(1))
                .join(' '),
    }));
  }, [logs]);

  const handleEntityTypeChange = useCallback(
    (entityType?: string) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (entityType) {
            next.set(ENTITY_TYPE_PARAM, entityType);
          } else {
            next.delete(ENTITY_TYPE_PARAM);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handleEntityNameChange = useCallback(
    (entityName?: string) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (entityName) {
            next.set(ENTITY_NAME_PARAM, entityName);
          } else {
            next.delete(ENTITY_NAME_PARAM);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handleRootEntityTypeChange = useCallback(
    (option?: (typeof ROOT_ENTITY_TYPE_OPTIONS)[number]) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (option) {
            next.set(ROOT_ENTITY_TYPE_PARAM, option.entityType);
          } else {
            next.delete(ROOT_ENTITY_TYPE_PARAM);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handleRootEntityNameChange = useCallback(
    (entityName?: string) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (entityName) {
            next.set(ROOT_ENTITY_NAME_PARAM, entityName);
          } else {
            next.delete(ROOT_ENTITY_NAME_PARAM);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const hasActiveFilters =
    searchQuery.length > 0 ||
    filterGroups.length > 0 ||
    datePreset !== '24h' ||
    !!selectedEntityType ||
    !!selectedEntityName ||
    !!selectedRootEntityType ||
    !!selectedRootEntityName;

  const handleReset = useCallback(() => {
    setSearchQuery('');
    clearAllFilters();
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev);
        next.delete(PERIOD_PARAM);
        next.delete(ENTITY_TYPE_PARAM);
        next.delete(ENTITY_NAME_PARAM);
        next.delete(ROOT_ENTITY_TYPE_PARAM);
        next.delete(ROOT_ENTITY_NAME_PARAM);
        return next;
      },
      { replace: true },
    );
  }, [clearAllFilters, setSearchParams, setSearchQuery]);

  if (logsError && is401UnauthorizedError(logsError)) {
    return (
      <EntityListPageLayout>
        <EntityListPageLayout.Top>
          <MainHeader withMargins={false}>
            <MainHeader.Column>
              <MainHeader.Title>
                <LogsIcon /> Logs
              </MainHeader.Title>
            </MainHeader.Column>
          </MainHeader>
        </EntityListPageLayout.Top>
        <div className="flex h-full items-center justify-center">
          <SessionExpired />
        </div>
      </EntityListPageLayout>
    );
  }

  if (logsError && is403ForbiddenError(logsError)) {
    return (
      <EntityListPageLayout>
        <EntityListPageLayout.Top>
          <MainHeader withMargins={false}>
            <MainHeader.Column>
              <MainHeader.Title>
                <LogsIcon /> Logs
              </MainHeader.Title>
            </MainHeader.Column>
          </MainHeader>
        </EntityListPageLayout.Top>
        <div className="flex h-full items-center justify-center">
          <PermissionDenied resource="logs" />
        </div>
      </EntityListPageLayout>
    );
  }

  return (
    <EntityListPageLayout className="max-w-none">
      <EntityListPageLayout.Top>
        <MainHeader withMargins={false}>
          <MainHeader.Column>
            <MainHeader.Title>
              <LogsIcon /> Logs
            </MainHeader.Title>
          </MainHeader.Column>
        </MainHeader>

        <LogsToolbar
          onSearchChange={setSearchQuery}
          datePreset={datePreset}
          onDatePresetChange={handleTimePeriodChange}
          selectedEntityType={selectedEntityType}
          entityTypeOptions={entityTypeOptions}
          onEntityTypeChange={handleEntityTypeChange}
          selectedEntityName={selectedEntityName}
          entityNameOptions={entityNameOptions}
          onEntityNameChange={handleEntityNameChange}
          selectedRootEntityType={selectedRootEntityType}
          rootEntityTypeOptions={[...ROOT_ENTITY_TYPE_OPTIONS]}
          onRootEntityTypeChange={handleRootEntityTypeChange}
          selectedRootEntityName={selectedRootEntityName}
          rootEntityNameOptions={rootEntityNameOptions}
          onRootEntityNameChange={handleRootEntityNameChange}
          filterGroups={filterGroups}
          filterColumns={filterColumns}
          onToggleComparator={toggleComparator}
          onRemoveFilterGroup={removeFilterGroup}
          onClearAllFilters={clearAllFilters}
          onFilterGroupsChange={updateFilterGroups}
          onReset={handleReset}
          isLoading={isLoadingLogs}
          hasActiveFilters={hasActiveFilters}
        />
      </EntityListPageLayout.Top>

      <LogsList
        logs={filteredLogs}
        isLoading={isLoadingLogs}
        isFetchingNextPage={isFetchingNextPage}
        hasNextPage={hasNextPage}
        setEndOfListElement={setEndOfListElement}
        error={logsError instanceof Error ? logsError : null}
        hasActiveFilters={hasActiveFilters}
        featuredLogId={featuredLogId}
        featuredTraceId={featuredTraceId}
        featuredSpanId={featuredSpanId}
        onFeaturedChange={handleFeaturedChange}
      />
    </EntityListPageLayout>
  );
}
