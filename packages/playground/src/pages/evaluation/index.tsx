import {
  DateTimeRangePicker,
  ErrorState,
  MetricsFlexGrid,
  NoDataPageLayout,
  PageLayout,
  PermissionDenied,
  SessionExpired,
  is401UnauthorizedError,
  is403ForbiddenError,
} from '@mastra/playground-ui';
import type { DateRangePreset } from '@mastra/playground-ui';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { DatasetHealthCard } from '@/domains/datasets';
import { useDatasets } from '@/domains/datasets/hooks/use-datasets';
import { useExperiments } from '@/domains/datasets/hooks/use-experiments';
import { EvaluationKpiCards } from '@/domains/evaluation/components/evaluation-kpi-cards';
import { ExperimentStatusCard } from '@/domains/experiments';
import { ReviewPipelineCard, useReviewSummary } from '@/domains/review';
import { computeReviewTotals } from '@/domains/review/review-maps';
import { useScoreMetrics, useScorers } from '@/domains/scores';
import { ScoresOverTimeCard } from '@/domains/scores/components/scores-over-time-card';

const PERIOD_PARAM = 'period';
const DATE_FROM_PARAM = 'dateFrom';
const DATE_TO_PARAM = 'dateTo';

const EVAL_PRESETS: readonly DateRangePreset[] = [
  'last-24h',
  'last-3d',
  'last-7d',
  'last-14d',
  'last-30d',
  'custom',
];

const PRESET_MS: Record<string, number> = {
  'last-24h': 24 * 60 * 60 * 1000,
  'last-3d': 3 * 24 * 60 * 60 * 1000,
  'last-7d': 7 * 24 * 60 * 60 * 1000,
  'last-14d': 14 * 24 * 60 * 60 * 1000,
  'last-30d': 30 * 24 * 60 * 60 * 1000,
};

const VALID_PRESETS = new Set<string>(EVAL_PRESETS);

function parseDateParam(raw: string | null): Date | undefined {
  if (!raw) return undefined;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export default function Evaluation() {
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Date range state from URL ──────────────────────────────────────────
  const periodParam = searchParams.get(PERIOD_PARAM);
  const datePreset: DateRangePreset = periodParam && VALID_PRESETS.has(periodParam) ? (periodParam as DateRangePreset) : 'last-24h';

  const customDateFrom = useMemo(() => parseDateParam(searchParams.get(DATE_FROM_PARAM)), [searchParams]);
  const customDateTo = useMemo(() => parseDateParam(searchParams.get(DATE_TO_PARAM)), [searchParams]);

  const handleDatePresetChange = useCallback(
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
          const paramKey = type === 'from' ? DATE_FROM_PARAM : DATE_TO_PARAM;
          if (value) {
            params.set(paramKey, value.toISOString());
          } else {
            params.delete(paramKey);
          }
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  // ── Compute date range for the data hook ───────────────────────────────
  const dateRange = useMemo(() => {
    if (datePreset === 'custom') {
      return customDateFrom || customDateTo ? { start: customDateFrom, end: customDateTo } : undefined;
    }
    const ms = PRESET_MS[datePreset];
    if (ms) return { start: new Date(Date.now() - ms) };
    return undefined;
  }, [datePreset, customDateFrom, customDateTo]);

  // ── Data hooks ─────────────────────────────────────────────────────────
  const { data: scorers, isLoading: isLoadingScorers, error: errorScorers } = useScorers();
  const { data: datasetsData, isLoading: isLoadingDatasets, error: errorDatasets } = useDatasets();
  const { data: experimentsData, isLoading: isLoadingExperiments, error: errorExperiments } = useExperiments();
  const {
    data: scoreMetrics,
    isLoading: isLoadingScores,
    isError: isErrorScores,
    error: errorScores,
  } = useScoreMetrics({ dateRange });
  const {
    data: reviewSummary,
    isLoading: isLoadingReview,
    isError: errorReview,
    error: errorReviewSummary,
  } = useReviewSummary();

  const datasets = datasetsData?.datasets;
  const experiments = experimentsData?.experiments;

  const reviewTotals = useMemo(() => computeReviewTotals(reviewSummary), [reviewSummary]);

  const error = errorScorers || errorDatasets || errorExperiments || errorScores || errorReviewSummary;

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
        <PermissionDenied resource="evaluation" />
      </NoDataPageLayout>
    );
  }

  if (error) {
    return (
      <NoDataPageLayout>
        <ErrorState title="Failed to load evaluation data" message={error.message} />
      </NoDataPageLayout>
    );
  }

  return (
    <PageLayout width="wide" height="full">
      <PageLayout.TopArea>
        <PageLayout.Row>
          <PageLayout.Column className="flex flex-wrap items-start justify-start gap-2 w-full">
            <DateTimeRangePicker
              preset={datePreset}
              onPresetChange={handleDatePresetChange}
              dateFrom={customDateFrom}
              dateTo={customDateTo}
              onDateChange={handleDateChange}
              disabled={isLoadingScores}
              presets={EVAL_PRESETS}
            />
          </PageLayout.Column>
        </PageLayout.Row>
      </PageLayout.TopArea>

      <div className="flex flex-col gap-6">
        <MetricsFlexGrid>
          <EvaluationKpiCards
            scorers={scorers}
            datasets={datasets}
            experiments={experiments}
            avgScore={scoreMetrics?.avgScore ?? null}
            prevAvgScore={scoreMetrics?.prevAvgScore ?? null}
            totalNeedsReview={reviewTotals.needsReview}
            isLoadingScorers={isLoadingScorers}
            isLoadingDatasets={isLoadingDatasets}
            isLoadingExperiments={isLoadingExperiments}
            isLoadingScores={isLoadingScores}
            isLoadingReview={isLoadingReview}
          />
        </MetricsFlexGrid>
        <ScoresOverTimeCard
          summaryData={scoreMetrics?.summaryData ?? []}
          overTimeData={scoreMetrics?.overTimeData ?? []}
          scorerNames={scoreMetrics?.scorerNames ?? []}
          avgScore={scoreMetrics?.avgScore ?? null}
          isLoading={isLoadingScores}
          isError={isErrorScores}
        />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <DatasetHealthCard experiments={experiments} isLoading={isLoadingExperiments} isError={!!errorExperiments} />
          <ExperimentStatusCard
            experiments={experiments}
            datasets={datasets}
            isLoading={isLoadingExperiments}
            isError={!!errorExperiments}
          />
        </div>
        <ReviewPipelineCard
          reviewSummary={reviewSummary}
          experiments={experiments}
          datasets={datasets}
          isLoading={isLoadingReview}
          isError={!!errorReview}
        />
      </div>
    </PageLayout>
  );
}
