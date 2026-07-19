import { DateTimeRangePicker } from '@mastra/playground-ui/components/DateTimeRangePicker';
import type { DateRangePreset } from '@mastra/playground-ui/components/DateTimeRangePicker';
import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
import { MetricsFlexGrid } from '@mastra/playground-ui/components/MetricsFlexGrid';
import { NoDataPageLayout, PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { useMemo, useState } from 'react';
import { DatasetHealthCard } from '@/domains/datasets';
import { useDatasets } from '@/domains/datasets/hooks/use-datasets';
import { useExperiments } from '@/domains/datasets/hooks/use-experiments';
import { EvaluationKpiCards } from '@/domains/evaluation/components/evaluation-kpi-cards';
import { ExperimentStatusCard } from '@/domains/experiments';
import { ReviewPipelineCard, useReviewSummary } from '@/domains/review';
import { computeReviewTotals } from '@/domains/review/review-maps';
import { useScoreMetrics, useScorers } from '@/domains/scores';
import type { ScoreMetricsDateRange } from '@/domains/scores';
import { ScoresOverTimeCard } from '@/domains/scores/components/scores-over-time-card';

export default function Evaluation() {
  const [datePreset, setDatePreset] = useState<DateRangePreset>('all');
  const [dateRange, setDateRange] = useState<ScoreMetricsDateRange>({});
  const { data: scorers, isLoading: isLoadingScorers, error: errorScorers } = useScorers();
  const { data: datasetsData, isLoading: isLoadingDatasets, error: errorDatasets } = useDatasets();
  const { data: experimentsData, isLoading: isLoadingExperiments, error: errorExperiments } = useExperiments();
  const {
    data: scoreMetrics,
    isLoading: isLoadingScores,
    isError: isErrorScores,
    error: errorScores,
  } = useScoreMetrics(dateRange);
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
          <PageLayout.Column>
            <DateTimeRangePicker
              preset={datePreset}
              onPresetChange={setDatePreset}
              dateFrom={dateRange.start}
              dateTo={dateRange.end}
              onDateChange={(value, type) =>
                setDateRange(current => (type === 'from' ? { ...current, start: value } : { ...current, end: value }))
              }
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
