import type { FeedbackRecord } from '@mastra/core/storage';
import { DataList, DataListSkeleton } from '@mastra/playground-ui/components/DataList';
import { DateTimeRangePicker } from '@mastra/playground-ui/components/DateTimeRangePicker';
import type { DateRangePreset } from '@mastra/playground-ui/components/DateTimeRangePicker';
import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
import { NoDataPageLayout, PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { PropertyFilterCreator } from '@mastra/playground-ui/components/PropertyFilter';
import type { PropertyFilterField, PropertyFilterToken } from '@mastra/playground-ui/components/PropertyFilter';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { format } from 'date-fns';
import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { TraceAsItemDialog } from '@/domains/observability/components/trace-as-item-dialog';
import { FeedbackDialog } from '@/domains/traces/components/feedback-dialog';
import { useFeedbackList } from '@/domains/traces/hooks/use-feedback-list';

const PERIOD_PARAM = 'period';
const DATE_FROM_PARAM = 'dateFrom';
const DATE_TO_PARAM = 'dateTo';
const PAGE_PARAM = 'page';

const DAY_MS = 24 * 60 * 60 * 1000;
const PRESET_MS: Partial<Record<DateRangePreset, number>> = {
  'last-24h': DAY_MS,
  'last-3d': 3 * DAY_MS,
  'last-7d': 7 * DAY_MS,
  'last-14d': 14 * DAY_MS,
  'last-30d': 30 * DAY_MS,
};
const PRESETS: readonly DateRangePreset[] = ['all', 'last-24h', 'last-3d', 'last-7d', 'last-14d', 'last-30d', 'custom'];

const FILTER_PARAM_BY_FIELD: Record<string, string> = {
  feedbackType: 'type',
  feedbackSource: 'source',
  feedbackUserId: 'user',
};

const filterFields: PropertyFilterField[] = [
  { id: 'feedbackType', label: 'Type', kind: 'text', placeholder: 'e.g. thumbs, rating, correction' },
  { id: 'feedbackSource', label: 'Source', kind: 'text', placeholder: 'e.g. user, system, manual' },
  { id: 'feedbackUserId', label: 'User', kind: 'text', placeholder: 'Filter by feedback user id' },
];

const feedbackListColumns = [
  { label: 'Type', size: '0.8fr' },
  { label: 'Value', size: '0.6fr' },
  { label: 'Comment', size: '2fr' },
  { label: 'Source', size: '0.8fr' },
  { label: 'User', size: '0.8fr' },
  { label: 'Date', size: '0.8fr' },
  { label: 'Time', size: '0.8fr' },
] as const;

const gridColumns = feedbackListColumns.map(c => c.size).join(' ');

/** For correction feedback, seed the dataset item's ground truth from the corrected value. */
function getCorrectionGroundTruth(fb?: FeedbackRecord): string | undefined {
  if (!fb || fb.feedbackType !== 'correction') return undefined;
  const correction = fb.value ?? fb.comment;
  if (correction == null) return undefined;
  return JSON.stringify(correction, null, 2);
}

function formatValue(fb: FeedbackRecord): string {
  if (fb.feedbackType === 'thumbs') {
    if (fb.value === 1) return '\u{1F44D}';
    if (fb.value === 0 || fb.value === -1) return '\u{1F44E}';
    return String(fb.value);
  }
  if (typeof fb.value === 'number') {
    return String(fb.value);
  }
  return '—';
}

function formatComment(fb: FeedbackRecord): string {
  const text = fb.comment || (typeof fb.value === 'string' ? fb.value : '');
  if (!text) return '—';
  return text.length > 60 ? text.slice(0, 60) + '…' : text;
}

function parseDate(raw: string | null): Date | undefined {
  if (!raw) return undefined;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export default function FeedbackPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [dialogIsOpen, setDialogIsOpen] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackRecord | undefined>();
  const [datasetDialogIsOpen, setDatasetDialogIsOpen] = useState(false);

  const rawPreset = searchParams.get(PERIOD_PARAM);
  const preset: DateRangePreset = PRESETS.includes(rawPreset as DateRangePreset)
    ? (rawPreset as DateRangePreset)
    : 'last-24h';

  const dateFrom = useMemo(() => {
    if (preset === 'custom') return parseDate(searchParams.get(DATE_FROM_PARAM));
    if (preset === 'all') return undefined;
    const ms = PRESET_MS[preset];
    return ms ? new Date(Date.now() - ms) : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, searchParams.toString()]);

  const dateTo = useMemo(() => {
    if (preset !== 'custom') return undefined;
    return parseDate(searchParams.get(DATE_TO_PARAM));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, searchParams.toString()]);

  const filterTokens = useMemo<PropertyFilterToken[]>(() => {
    const tokens: PropertyFilterToken[] = [];
    for (const [fieldId, param] of Object.entries(FILTER_PARAM_BY_FIELD)) {
      const value = searchParams.get(param);
      if (value) tokens.push({ fieldId, value });
    }
    return tokens;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  const page = Math.max(0, Number(searchParams.get(PAGE_PARAM)) || 0);

  const handleFilterTokensChange = useCallback(
    (nextTokens: PropertyFilterToken[]) => {
      setSearchParams(
        prev => {
          const params = new URLSearchParams(prev);
          for (const param of Object.values(FILTER_PARAM_BY_FIELD)) params.delete(param);
          for (const token of nextTokens) {
            const param = FILTER_PARAM_BY_FIELD[token.fieldId];
            const value = Array.isArray(token.value) ? token.value[0] : token.value;
            if (param && value) params.set(param, value);
          }
          params.delete(PAGE_PARAM);
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handlePresetChange = useCallback(
    (next: DateRangePreset) => {
      setSearchParams(
        prev => {
          const params = new URLSearchParams(prev);
          if (next === 'last-24h') {
            params.delete(PERIOD_PARAM);
          } else {
            params.set(PERIOD_PARAM, next);
          }
          if (next !== 'custom') {
            params.delete(DATE_FROM_PARAM);
            params.delete(DATE_TO_PARAM);
          }
          params.delete(PAGE_PARAM);
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handleDateChange = useCallback(
    (value: Date | undefined, type: 'from' | 'to') => {
      setSearchParams(
        prev => {
          const params = new URLSearchParams(prev);
          const param = type === 'from' ? DATE_FROM_PARAM : DATE_TO_PARAM;
          if (value) {
            params.set(param, value.toISOString());
          } else {
            params.delete(param);
          }
          params.delete(PAGE_PARAM);
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handlePageChange = useCallback(
    (nextPage: number) => {
      setSearchParams(
        prev => {
          const params = new URLSearchParams(prev);
          if (nextPage > 0) {
            params.set(PAGE_PARAM, String(nextPage));
          } else {
            params.delete(PAGE_PARAM);
          }
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const filters = useMemo(() => {
    const type = searchParams.get(FILTER_PARAM_BY_FIELD.feedbackType!);
    const source = searchParams.get(FILTER_PARAM_BY_FIELD.feedbackSource!);
    const user = searchParams.get(FILTER_PARAM_BY_FIELD.feedbackUserId!);
    return {
      ...(type ? { feedbackType: type } : {}),
      ...(source ? { feedbackSource: source } : {}),
      ...(user ? { feedbackUserId: user } : {}),
      ...(dateFrom || dateTo ? { timestamp: { start: dateFrom, end: dateTo } } : {}),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString(), dateFrom, dateTo]);

  const { data: feedbackData, isLoading, error } = useFeedbackList({ filters, page });

  if (error && is401UnauthorizedError(error)) {
    return (
      <NoDataPageLayout>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <NoDataPageLayout>
        <PermissionDenied resource="feedback" />
      </NoDataPageLayout>
    );
  }

  if (error) {
    return (
      <NoDataPageLayout>
        <ErrorState title="Failed to load feedback" message={error.message} />
      </NoDataPageLayout>
    );
  }

  const feedbackItems = feedbackData?.feedback ?? [];
  const currentPage = feedbackData?.pagination?.page ?? page;

  const handleOnFeedback = (index: number) => {
    setSelectedFeedback(feedbackItems[index]);
    setDialogIsOpen(true);
  };

  const selectedIndex = selectedFeedback ? feedbackItems.indexOf(selectedFeedback) : -1;
  const toNext =
    selectedIndex >= 0 && selectedIndex < feedbackItems.length - 1
      ? () => setSelectedFeedback(feedbackItems[selectedIndex + 1])
      : undefined;
  const toPrevious = selectedIndex > 0 ? () => setSelectedFeedback(feedbackItems[selectedIndex - 1]) : undefined;

  return (
    <PageLayout width="wide" height="full">
      <PageLayout.TopArea>
        <PageLayout.Row>
          <PageLayout.Column className="flex flex-wrap items-start justify-start gap-2">
            <DateTimeRangePicker
              preset={preset}
              onPresetChange={handlePresetChange}
              dateFrom={dateFrom}
              dateTo={dateTo}
              onDateChange={handleDateChange}
              disabled={isLoading}
              presets={PRESETS}
            />
            <PropertyFilterCreator
              fields={filterFields}
              tokens={filterTokens}
              onTokensChange={handleFilterTokensChange}
              disabled={isLoading}
            />
          </PageLayout.Column>
        </PageLayout.Row>
      </PageLayout.TopArea>

      {isLoading ? (
        <DataListSkeleton columns={gridColumns} />
      ) : (
        <DataList columns={gridColumns}>
          <DataList.Top>
            {feedbackListColumns.map(col => (
              <DataList.TopCell key={col.label}>{col.label}</DataList.TopCell>
            ))}
          </DataList.Top>

          {feedbackItems.length === 0 ? (
            <DataList.NoMatch message="No feedback found" />
          ) : (
            feedbackItems.map((fb, index) => {
              const ts = new Date(fb.timestamp);
              return (
                <DataList.RowButton
                  key={fb.feedbackId ?? `${fb.traceId}-${index}`}
                  onClick={() => handleOnFeedback(index)}
                >
                  <DataList.Cell height="compact">{fb.feedbackType}</DataList.Cell>
                  <DataList.Cell height="compact">{formatValue(fb)}</DataList.Cell>
                  <DataList.Cell height="compact">{formatComment(fb)}</DataList.Cell>
                  <DataList.Cell height="compact">{fb.feedbackSource || '—'}</DataList.Cell>
                  <DataList.Cell height="compact">{fb.feedbackUserId || '—'}</DataList.Cell>
                  <DataList.DateCell timestamp={ts} />
                  <DataList.Cell height="compact">{format(ts, 'h:mm:ss aaa')}</DataList.Cell>
                </DataList.RowButton>
              );
            })
          )}

          <DataList.Pagination
            currentPage={currentPage}
            hasMore={feedbackData?.pagination?.hasMore}
            onNextPage={() => handlePageChange(currentPage + 1)}
            onPrevPage={() => {
              if (currentPage > 0) handlePageChange(currentPage - 1);
            }}
          />
        </DataList>
      )}

      <FeedbackDialog
        showTraceLink
        feedback={selectedFeedback}
        isOpen={dialogIsOpen}
        onClose={() => setDialogIsOpen(false)}
        onNext={toNext}
        onPrevious={toPrevious}
        onAddToDataset={() => setDatasetDialogIsOpen(true)}
      />

      <TraceAsItemDialog
        traceId={selectedFeedback?.traceId ?? undefined}
        initialGroundTruthOverride={getCorrectionGroundTruth(selectedFeedback)}
        isOpen={datasetDialogIsOpen}
        onClose={() => setDatasetDialogIsOpen(false)}
        level={3}
      />
    </PageLayout>
  );
}
