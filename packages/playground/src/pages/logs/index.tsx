import type { PropertyFilterToken } from '@mastra/playground-ui';
import {
  ButtonWithTooltip,
  DateTimeRangePicker,
  ErrorState,
  NoDataPageLayout,
  PageHeader,
  PageLayout,
  PermissionDenied,
  PropertyFilterCreator,
  SessionExpired,
  is401UnauthorizedError,
  is403ForbiddenError,
  toast,
} from '@mastra/playground-ui';
import { BookIcon, LogsIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { FeaturedIds } from '@/domains/logs';
import { LogsList, LogsToolbar } from '@/domains/logs';
import { NoLogsInfo } from '@/domains/logs/components/no-logs-info';
import { useLogs } from '@/domains/logs/hooks/use-logs';
import {
  applyLogsPropertyFilterTokens,
  buildLogsListFilters,
  clearSavedLogsFilters,
  createLogsPropertyFilterFields,
  getLogsPropertyFilterTokens,
  hasAnyLogsFilterParams,
  loadLogsFiltersFromStorage,
  LOGS_DATE_FROM_PARAM,
  LOGS_DATE_PRESET_PARAM,
  LOGS_DATE_PRESET_VALUES,
  LOGS_DATE_TO_PARAM,
  LOGS_PROPERTY_FILTER_FIELD_IDS,
  LOGS_PROPERTY_FILTER_PARAM_BY_FIELD,
  LOGS_ROOT_ENTITY_TYPE_OPTIONS,
  LOGS_ROOT_ENTITY_TYPE_PARAM,
  saveLogsFiltersToStorage,
} from '@/domains/logs/log-filters';
import type { LogsDatePreset } from '@/domains/logs/log-filters';
import { useEntityNames } from '@/domains/observability/hooks/use-entity-names';
import { useEnvironments } from '@/domains/observability/hooks/use-environments';
import { useServiceNames } from '@/domains/observability/hooks/use-service-names';
import { useTags } from '@/domains/observability/hooks/use-tags';

const LOG_PARAM = 'logId';
const TRACE_PARAM = 'traceId';
const SPAN_PARAM = 'spanId';

const DAY_MS = 24 * 60 * 60 * 1000;
const PRESET_MS: Partial<Record<LogsDatePreset, number>> = {
  'last-24h': DAY_MS,
  'last-3d': 3 * DAY_MS,
  'last-7d': 7 * DAY_MS,
  'last-14d': 14 * DAY_MS,
  'last-30d': 30 * DAY_MS,
};

/** Clear featured-log selections from URL when filters change. */
function clearSelectionParams(params: URLSearchParams) {
  params.delete(LOG_PARAM);
  params.delete(TRACE_PARAM);
  params.delete(SPAN_PARAM);
}

export default function Logs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [autoFocusFilterFieldId, setAutoFocusFilterFieldId] = useState<string | undefined>();

  const datePreset = useMemo<LogsDatePreset>(() => {
    const value = searchParams.get(LOGS_DATE_PRESET_PARAM);
    return value && LOGS_DATE_PRESET_VALUES.has(value as LogsDatePreset) ? (value as LogsDatePreset) : 'last-24h';
  }, [searchParams]);

  const dateFromParamRaw = searchParams.get(LOGS_DATE_FROM_PARAM);
  const dateToParamRaw = searchParams.get(LOGS_DATE_TO_PARAM);

  const selectedDateFrom = useMemo(() => {
    if (datePreset === 'custom') {
      if (!dateFromParamRaw) return undefined;
      const parsed = new Date(dateFromParamRaw);
      return Number.isNaN(parsed.getTime()) ? undefined : parsed;
    }
    if (datePreset === 'all') return undefined;
    const ms = PRESET_MS[datePreset];
    return ms ? new Date(Date.now() - ms) : undefined;
  }, [datePreset, dateFromParamRaw]);

  const selectedDateTo = useMemo(() => {
    if (datePreset !== 'custom' || !dateToParamRaw) return undefined;
    const parsed = new Date(dateToParamRaw);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }, [datePreset, dateToParamRaw]);

  // Mirror of `handleDatePresetChange` — keeps a synchronous ref so the
  // DateTimeRangePicker's onDateChange (fired alongside preset changes) can
  // bail out when the user just picked a non-custom preset.
  const datePresetRef = useRef(datePreset);
  datePresetRef.current = datePreset;

  const featuredLogId = searchParams.get(LOG_PARAM);
  const featuredTraceId = searchParams.get(TRACE_PARAM);
  const featuredSpanId = searchParams.get(SPAN_PARAM);

  const selectedEntityOption = useMemo(
    () =>
      LOGS_ROOT_ENTITY_TYPE_OPTIONS.find(option => option.entityType === searchParams.get(LOGS_ROOT_ENTITY_TYPE_PARAM)),
    [searchParams],
  );

  const filterTokens = useMemo(() => getLogsPropertyFilterTokens(searchParams), [searchParams]);

  const { data: availableTags = [], isPending: isTagsLoading } = useTags();
  const { data: rootEntityNameSuggestions = [], isPending: isEntityNamesLoading } = useEntityNames({
    entityType: selectedEntityOption?.entityType,
    rootOnly: true,
  });
  const { data: discoveredEnvironments = [], isPending: isEnvironmentsLoading } = useEnvironments();
  const { data: discoveredServiceNames = [], isPending: isServiceNamesLoading } = useServiceNames();

  const filterFields = useMemo(
    () =>
      createLogsPropertyFilterFields({
        availableTags,
        availableRootEntityNames: rootEntityNameSuggestions,
        availableServiceNames: discoveredServiceNames,
        availableEnvironments: discoveredEnvironments,
        loading: {
          tags: isTagsLoading,
          entityNames: isEntityNamesLoading,
          serviceNames: isServiceNamesLoading,
          environments: isEnvironmentsLoading,
        },
      }),
    [
      availableTags,
      rootEntityNameSuggestions,
      discoveredServiceNames,
      discoveredEnvironments,
      isTagsLoading,
      isEntityNamesLoading,
      isServiceNamesLoading,
      isEnvironmentsLoading,
    ],
  );

  const logsFilters = useMemo(
    () =>
      buildLogsListFilters({
        rootEntityType: selectedEntityOption?.entityType,
        dateFrom: selectedDateFrom,
        dateTo: selectedDateTo,
        tokens: filterTokens,
      }),
    [filterTokens, selectedDateFrom, selectedDateTo, selectedEntityOption],
  );

  const {
    data: logs = [],
    isLoading: isLoadingLogs,
    error: logsError,
    isFetchingNextPage,
    hasNextPage,
    setEndOfListElement,
  } = useLogs({ filters: logsFilters });

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

  const handleFilterTokensChange = useCallback(
    (nextTokens: PropertyFilterToken[]) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          applyLogsPropertyFilterTokens(next, nextTokens);
          clearSelectionParams(next);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handleDateChange = useCallback(
    (value: Date | undefined, type: 'from' | 'to') => {
      if (datePresetRef.current !== 'custom') return;
      const param = type === 'from' ? LOGS_DATE_FROM_PARAM : LOGS_DATE_TO_PARAM;
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (value) {
            next.set(param, value.toISOString());
          } else {
            next.delete(param);
          }
          clearSelectionParams(next);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handleDatePresetChange = useCallback(
    (preset: LogsDatePreset) => {
      datePresetRef.current = preset;
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (preset === 'last-24h') {
            next.delete(LOGS_DATE_PRESET_PARAM);
            next.delete(LOGS_DATE_FROM_PARAM);
            next.delete(LOGS_DATE_TO_PARAM);
          } else if (preset === 'custom') {
            next.set(LOGS_DATE_PRESET_PARAM, 'custom');
          } else {
            next.set(LOGS_DATE_PRESET_PARAM, preset);
            next.delete(LOGS_DATE_FROM_PARAM);
            next.delete(LOGS_DATE_TO_PARAM);
          }
          clearSelectionParams(next);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const [hasSavedFilters, setHasSavedFilters] = useState(() => loadLogsFiltersFromStorage() !== null);

  const handleSave = useCallback(() => {
    saveLogsFiltersToStorage(searchParams);
    setHasSavedFilters(true);
    toast.success('Filters setting for Logs saved');
  }, [searchParams]);

  const handleRemoveSaved = useCallback(() => {
    clearSavedLogsFilters();
    setHasSavedFilters(false);
    toast.success('Filters setting for Logs cleared up');
  }, []);

  // Mount-time hydration: if the URL arrived filter-clean (plain sidebar nav),
  // restore a previously saved filter set.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    if (hasAnyLogsFilterParams(searchParams)) return;
    const saved = loadLogsFiltersFromStorage();
    if (!saved) return;
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of saved) {
          next.append(key, value);
        }
        return next;
      },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRemoveAll = useCallback(() => {
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev);
        next.delete(LOGS_ROOT_ENTITY_TYPE_PARAM);
        for (const fieldId of LOGS_PROPERTY_FILTER_FIELD_IDS) {
          next.delete(LOGS_PROPERTY_FILTER_PARAM_BY_FIELD[fieldId]);
        }
        clearSelectionParams(next);
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  const handleClear = useCallback(() => {
    const neutralTokens: PropertyFilterToken[] = filterTokens.map(token => {
      const field = filterFields.find(f => f.id === token.fieldId);
      if (!field) return token;
      if (field.kind === 'text') return { fieldId: token.fieldId, value: '' };
      if (field.kind === 'pick-multi') {
        return field.multi ? { fieldId: token.fieldId, value: [] } : { fieldId: token.fieldId, value: 'Any' };
      }
      return token;
    });
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev);
        applyLogsPropertyFilterTokens(next, neutralTokens);
        clearSelectionParams(next);
        return next;
      },
      { replace: true },
    );
  }, [filterFields, filterTokens, setSearchParams]);

  if (logsError && is401UnauthorizedError(logsError)) {
    return (
      <NoDataPageLayout title="Logs" icon={<LogsIcon />}>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  if (logsError && is403ForbiddenError(logsError)) {
    return (
      <NoDataPageLayout title="Logs" icon={<LogsIcon />}>
        <PermissionDenied resource="logs" />
      </NoDataPageLayout>
    );
  }

  if (logsError) {
    return (
      <NoDataPageLayout title="Logs" icon={<LogsIcon />}>
        <ErrorState title="Failed to load logs" message={logsError?.message ?? 'Unknown error'} />
      </NoDataPageLayout>
    );
  }

  const hasActiveFilters = filterTokens.length > 0 || datePreset !== 'last-24h' || !!selectedDateTo;

  if (logs.length === 0 && !isLoadingLogs && !hasActiveFilters) {
    return (
      <NoDataPageLayout title="Logs" icon={<LogsIcon />}>
        <NoLogsInfo />
      </NoDataPageLayout>
    );
  }

  return (
    <PageLayout width="wide" height="full">
      <PageLayout.TopArea>
        <PageLayout.Row>
          <PageLayout.Column>
            <PageHeader>
              <PageHeader.Title isLoading={isLoadingLogs}>
                <LogsIcon /> Logs
              </PageHeader.Title>
            </PageHeader>
          </PageLayout.Column>
          <PageLayout.Column className="flex justify-end items-center gap-2">
            <DateTimeRangePicker
              preset={datePreset}
              onPresetChange={handleDatePresetChange}
              dateFrom={selectedDateFrom}
              dateTo={selectedDateTo}
              onDateChange={handleDateChange}
              disabled={isLoadingLogs}
              presets={['last-24h', 'last-3d', 'last-7d', 'last-14d', 'last-30d', 'custom']}
            />
            <PropertyFilterCreator
              fields={filterFields}
              tokens={filterTokens}
              onTokensChange={handleFilterTokensChange}
              disabled={isLoadingLogs}
              onStartTextFilter={setAutoFocusFilterFieldId}
            />
            <ButtonWithTooltip
              as="a"
              href="https://mastra.ai/en/docs/observability/logs/overview"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Logs documentation"
              tooltipContent="Go to Logs documentation"
            >
              <BookIcon />
            </ButtonWithTooltip>
          </PageLayout.Column>
        </PageLayout.Row>

        <LogsToolbar
          isLoading={isLoadingLogs}
          filterFields={filterFields}
          filterTokens={filterTokens}
          onFilterTokensChange={handleFilterTokensChange}
          onClear={handleClear}
          onRemoveAll={handleRemoveAll}
          onSave={handleSave}
          onRemoveSaved={hasSavedFilters ? handleRemoveSaved : undefined}
          autoFocusFilterFieldId={autoFocusFilterFieldId}
        />
      </PageLayout.TopArea>

      <LogsList
        logs={logs}
        isLoading={isLoadingLogs}
        isFetchingNextPage={isFetchingNextPage}
        hasNextPage={hasNextPage}
        setEndOfListElement={setEndOfListElement}
        featuredLogId={featuredLogId}
        featuredTraceId={featuredTraceId}
        featuredSpanId={featuredSpanId}
        onFeaturedChange={handleFeaturedChange}
      />
    </PageLayout>
  );
}
