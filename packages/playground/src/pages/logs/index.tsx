import type { EntityType } from '@mastra/core/observability';
import type {
  FeaturedIds,
  LogsDatePreset,
  LogLevel,
  PropertyFilterOption,
  PropertyFilterToken,
} from '@mastra/playground-ui';
import {
  MainHeader,
  LogsList,
  LogsToolbar,
  ROOT_ENTITY_TYPE_OPTIONS,
  isValidLogsDatePreset,
  useEntityNames,
  useTags,
  useEnvironments,
  useServiceNames,
  EntityListPageLayout,
  PermissionDenied,
  SessionExpired,
  is403ForbiddenError,
  is401UnauthorizedError,
} from '@mastra/playground-ui';
import { LogsIcon } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { useLogs } from '@/domains/logs/hooks/use-logs';
import {
  applyLogsPropertyFilterTokens,
  buildLogsListFilters,
  createLogsPropertyFilterFields,
  getLogsPropertyFilterTokens,
  LOG_LEVEL_VALUES,
  LOGS_LEVEL_PARAM,
  LOGS_LOG_ID_PARAM,
  LOGS_PERIOD_PARAM,
  LOGS_PROPERTY_FILTER_FIELD_IDS,
  LOGS_PROPERTY_FILTER_PARAM_BY_FIELD,
  LOGS_ROOT_ENTITY_TYPE_PARAM,
  LOGS_SPAN_ID_PARAM,
  LOGS_TRACE_ID_PARAM,
} from '@/domains/logs/log-filters';

const PRESET_TO_MS: Record<LogsDatePreset, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '3d': 3 * 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '14d': 14 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};
const INITIAL_SUGGESTION_LIMIT = 5;
const FILTERED_SUGGESTION_LIMIT = 20;

function getTokenValue(tokens: PropertyFilterToken[], fieldId: string) {
  const token = tokens.find(candidate => candidate.fieldId === fieldId);
  return typeof token?.value === 'string' ? token.value : undefined;
}

export default function Logs() {
  const [searchParams, setSearchParams] = useSearchParams();

  const presetParam = searchParams.get(LOGS_PERIOD_PARAM);
  const datePreset = isValidLogsDatePreset(presetParam) ? presetParam : '24h';
  const featuredLogId = searchParams.get(LOGS_LOG_ID_PARAM);
  const featuredTraceId = searchParams.get(LOGS_TRACE_ID_PARAM);
  const featuredSpanId = searchParams.get(LOGS_SPAN_ID_PARAM);
  const selectedRootEntityType = ROOT_ENTITY_TYPE_OPTIONS.find(
    option => option.entityType === searchParams.get(LOGS_ROOT_ENTITY_TYPE_PARAM),
  );
  const selectedLevel = useMemo(() => {
    const value = searchParams.get(LOGS_LEVEL_PARAM);
    return value && LOG_LEVEL_VALUES.has(value as LogLevel) ? (value as LogLevel) : undefined;
  }, [searchParams]);
  const filterTokens = useMemo(() => getLogsPropertyFilterTokens(searchParams), [searchParams]);

  const selectedEntityType = getTokenValue(filterTokens, 'entityType');

  const { data: availableTags = [] } = useTags();
  const { data: entityNameSuggestions = [] } = useEntityNames({
    entityType: selectedEntityType as EntityType | undefined,
  });
  const { data: rootEntityNameSuggestions = [] } = useEntityNames({
    entityType: selectedRootEntityType?.entityType,
    rootOnly: true,
  });
  const { data: environmentSuggestions = [] } = useEnvironments();
  const { data: serviceNameSuggestions = [] } = useServiceNames();

  const filterFields = useMemo(() => createLogsPropertyFilterFields(availableTags), [availableTags]);

  const logsFilters = useMemo(() => {
    const ms = PRESET_TO_MS[datePreset] ?? PRESET_TO_MS['24h'];

    return buildLogsListFilters({
      rootEntityType: selectedRootEntityType?.entityType,
      level: selectedLevel,
      start: new Date(Date.now() - ms),
      tokens: filterTokens,
    });
  }, [datePreset, filterTokens, selectedLevel, selectedRootEntityType]);

  const {
    data: logs = [],
    isLoading: isLoadingLogs,
    error: logsError,
    isFetchingNextPage,
    hasNextPage,
    setEndOfListElement,
  } = useLogs({ filters: logsFilters });

  const loadSuggestions = useCallback(
    async (fieldId: string, query: string): Promise<PropertyFilterOption[]> => {
      const normalizedQuery = query.trim().toLowerCase();

      const source =
        fieldId === 'entityName'
          ? entityNameSuggestions
          : fieldId === 'rootEntityName'
            ? rootEntityNameSuggestions
            : fieldId === 'serviceName'
              ? serviceNameSuggestions
              : fieldId === 'environment'
                ? environmentSuggestions
                : [];

      const values = normalizedQuery
        ? source.filter(value => value.toLowerCase().includes(normalizedQuery)).slice(0, FILTERED_SUGGESTION_LIMIT)
        : source.slice(0, INITIAL_SUGGESTION_LIMIT);

      return values.map(value => ({ label: value, value }));
    },
    [entityNameSuggestions, environmentSuggestions, rootEntityNameSuggestions, serviceNameSuggestions],
  );

  const handleDatePresetChange = useCallback(
    (preset: LogsDatePreset) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (preset === '24h') {
            next.delete(LOGS_PERIOD_PARAM);
          } else {
            next.set(LOGS_PERIOD_PARAM, preset);
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
            const param =
              field === 'logId' ? LOGS_LOG_ID_PARAM : field === 'traceId' ? LOGS_TRACE_ID_PARAM : LOGS_SPAN_ID_PARAM;
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

  const handleRootEntityTypeChange = useCallback(
    (option?: (typeof ROOT_ENTITY_TYPE_OPTIONS)[number]) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (option) {
            next.set(LOGS_ROOT_ENTITY_TYPE_PARAM, option.entityType);
          } else {
            next.delete(LOGS_ROOT_ENTITY_TYPE_PARAM);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handleLevelChange = useCallback(
    (level?: LogLevel) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (level) {
            next.set(LOGS_LEVEL_PARAM, level);
          } else {
            next.delete(LOGS_LEVEL_PARAM);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handleFilterTokensChange = useCallback(
    (nextTokens: PropertyFilterToken[]) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          applyLogsPropertyFilterTokens(next, nextTokens);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const hasActiveFilters =
    datePreset !== '24h' || !!selectedRootEntityType || !!selectedLevel || filterTokens.length > 0;

  const handleReset = useCallback(() => {
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev);
        next.delete(LOGS_PERIOD_PARAM);
        next.delete(LOGS_ROOT_ENTITY_TYPE_PARAM);
        next.delete(LOGS_LEVEL_PARAM);
        for (const fieldId of LOGS_PROPERTY_FILTER_FIELD_IDS) {
          next.delete(LOGS_PROPERTY_FILTER_PARAM_BY_FIELD[fieldId]);
        }
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

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
          datePreset={datePreset}
          onDatePresetChange={handleDatePresetChange}
          selectedRootEntityType={selectedRootEntityType}
          rootEntityTypeOptions={[...ROOT_ENTITY_TYPE_OPTIONS]}
          onRootEntityTypeChange={handleRootEntityTypeChange}
          selectedLevel={selectedLevel}
          onLevelChange={handleLevelChange}
          filterFields={filterFields}
          filterTokens={filterTokens}
          onFilterTokensChange={handleFilterTokensChange}
          loadSuggestions={loadSuggestions}
          onReset={handleReset}
          isLoading={isLoadingLogs}
          hasActiveFilters={hasActiveFilters}
        />
      </EntityListPageLayout.Top>

      <LogsList
        logs={logs}
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
