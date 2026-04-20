import {
  ButtonWithTooltip,
  ErrorState,
  MetricsFlexGrid,
  NoDataPageLayout,
  PageHeader,
  PageLayout,
  PermissionDenied,
  SessionExpired,
  is401UnauthorizedError,
  is403ForbiddenError,
} from '@mastra/playground-ui';
import { BookIcon, FlaskConicalIcon } from 'lucide-react';
import { useMemo } from 'react';
import { DatasetHealthCard } from '@/domains/datasets';
import { useDatasets } from '@/domains/datasets/hooks/use-datasets';
import { useExperiments } from '@/domains/datasets/hooks/use-experiments';
import { EvaluationKpiCards } from '@/domains/evaluation/components/evaluation-kpi-cards';
import { ExperimentStatusCard } from '@/domains/experiments';
import { ReviewPipelineCard, useReviewSummary } from '@/domains/review';
import { computeReviewTotals } from '@/domains/review/review-maps';
import { useScoreMetrics, useScorers } from '@/domains/scores';
import { ScoresOverTimeCard } from '@/domains/scores/components/scores-over-time-card';

export default function Evaluation() {
  const { data: scorers, isLoading: isLoadingScorers, error: errorScorers } = useScorers();
  const { data: datasetsData, isLoading: isLoadingDatasets, error: errorDatasets } = useDatasets();
  const { data: experimentsData, isLoading: isLoadingExperiments, error: errorExperiments } = useExperiments();
  const {
    data: scoreMetrics,
    isLoading: isLoadingScores,
    isError: isErrorScores,
    error: errorScores,
  } = useScoreMetrics();
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
      <NoDataPageLayout title="Evaluation" icon={<FlaskConicalIcon />}>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <NoDataPageLayout title="Evaluation" icon={<FlaskConicalIcon />}>
        <PermissionDenied resource="evaluation" />
      </NoDataPageLayout>
    );
  }

  if (error) {
    return (
      <NoDataPageLayout title="Evaluation" icon={<FlaskConicalIcon />}>
        <ErrorState title="Failed to load evaluation data" message={error.message} />
      </NoDataPageLayout>
    );
  }

  return (
    <PageLayout width="wide" height="full">
      <PageLayout.TopArea className="sticky top-0 z-100 bg-surface1 ">
        <PageLayout.Row>
          <PageLayout.Column>
            <PageHeader>
              <PageHeader.Title>
                <FlaskConicalIcon /> Evaluation
              </PageHeader.Title>
            </PageHeader>
          </PageLayout.Column>
          <PageLayout.Column className="flex justify-end gap-2">
            <ButtonWithTooltip
              as="a"
              href="https://mastra.ai/en/docs/evals/overview"
              target="_blank"
              rel="noopener noreferrer"
              tooltipContent="Go to Evaluation documentation"
            >
              <BookIcon />
            </ButtonWithTooltip>
          </PageLayout.Column>
        </PageLayout.Row>
      </PageLayout.TopArea>

      <div className="flex flex-col gap-6 pt-4">
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
