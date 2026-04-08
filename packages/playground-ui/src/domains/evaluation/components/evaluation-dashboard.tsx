import { useMemo } from 'react';
import {
  useEvaluationScorers,
  useEvaluationDatasets,
  useEvaluationExperiments,
} from '../hooks/use-evaluation-dashboard';
import { useEvaluationScoreMetrics } from '../hooks/use-evaluation-score-metrics';
import { useReviewSummary } from '../hooks/use-review-summary';
import { DatasetHealthCard } from './dataset-health-card';
import { EvaluationDatasetsList } from './evaluation-datasets-list';
import { EvaluationExperimentsList } from './evaluation-experiments-list';
import { EvaluationKpiCards } from './evaluation-kpi-cards';
import { EvaluationScorersList } from './evaluation-scorers-list';
import { ExperimentStatusCard } from './experiment-status-card';
import { ReviewPipelineCard } from './review-pipeline-card';
import { ScoresOverTimeCard } from './scores-over-time-card';
import { MetricsFlexGrid } from '@/ds/components/MetricsFlexGrid';

export type EvaluationTab = 'overview' | 'scorers' | 'datasets' | 'experiments';

interface EvaluationDashboardProps {
  activeTab?: EvaluationTab;
  defaultTab?: EvaluationTab;
  scorerSearch?: string;
  scorerSourceFilter?: string;
  datasetSearch?: string;
  datasetTargetFilter?: string;
  datasetExperimentFilter?: string;
  datasetTagFilter?: string;
  experimentSearch?: string;
  experimentStatusFilter?: string;
  experimentDatasetFilter?: string;
}

export function EvaluationDashboard({
  activeTab,
  defaultTab = 'overview',
  scorerSearch,
  scorerSourceFilter,
  datasetSearch,
  datasetTargetFilter,
  datasetExperimentFilter,
  datasetTagFilter,
  experimentSearch,
  experimentStatusFilter,
  experimentDatasetFilter,
}: EvaluationDashboardProps) {
  const { data: scorers, isLoading: isLoadingScorers, error: errorScorers } = useEvaluationScorers();
  const { data: datasetsData, isLoading: isLoadingDatasets, error: errorDatasets } = useEvaluationDatasets();
  const {
    data: experimentsData,
    isLoading: isLoadingExperiments,
    error: errorExperiments,
  } = useEvaluationExperiments();
  const { data: scoreMetrics, isLoading: isLoadingScores, isError: isErrorScores } = useEvaluationScoreMetrics();
  const { data: reviewSummary, isLoading: isLoadingReview, isError: errorReview } = useReviewSummary();

  const datasets = datasetsData?.datasets;
  const experiments = experimentsData?.experiments;

  const reviewByExperiment = useMemo(() => {
    const map = new Map<string, { needsReview: number; complete: number; total: number }>();
    if (!reviewSummary?.counts) return map;
    for (const c of reviewSummary.counts) {
      map.set(c.experimentId, { needsReview: c.needsReview, complete: c.complete, total: c.total });
    }
    return map;
  }, [reviewSummary]);

  const reviewByDataset = useMemo(() => {
    const map = new Map<string, { needsReview: number; complete: number }>();
    if (!reviewByExperiment.size || !experiments) return map;
    for (const exp of experiments) {
      const review = reviewByExperiment.get(exp.id);
      if (!review || !exp.datasetId) continue;
      const inPipeline = review.needsReview + review.complete;
      if (inPipeline === 0) continue;
      const existing = map.get(exp.datasetId) ?? { needsReview: 0, complete: 0 };
      existing.needsReview += review.needsReview;
      existing.complete += review.complete;
      map.set(exp.datasetId, existing);
    }
    return map;
  }, [reviewByExperiment, experiments]);

  const reviewTotals = useMemo(() => {
    if (!reviewSummary?.counts) return { needsReview: 0, complete: 0, inPipeline: 0 };
    return reviewSummary.counts.reduce(
      (acc, c) => ({
        needsReview: acc.needsReview + c.needsReview,
        complete: acc.complete + c.complete,
        inPipeline: acc.inPipeline + c.needsReview + c.complete,
      }),
      { needsReview: 0, complete: 0, inPipeline: 0 },
    );
  }, [reviewSummary]);

  const tab = activeTab ?? defaultTab;

  return (
    <>
      {tab === 'overview' && (
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
            <DatasetHealthCard
              experiments={experiments}
              isLoading={isLoadingExperiments}
              isError={!!errorExperiments}
            />
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
      )}

      {tab === 'scorers' && (
        <EvaluationScorersList
          scorers={scorers ?? {}}
          isLoading={isLoadingScorers}
          error={errorScorers}
          search={scorerSearch}
          sourceFilter={scorerSourceFilter}
        />
      )}

      {tab === 'datasets' && (
        <EvaluationDatasetsList
          datasets={datasets ?? []}
          experiments={experiments ?? []}
          reviewByDataset={reviewByDataset}
          isLoading={isLoadingDatasets || isLoadingExperiments}
          error={errorDatasets ?? errorExperiments}
          search={datasetSearch}
          targetFilter={datasetTargetFilter}
          experimentFilter={datasetExperimentFilter}
          tagFilter={datasetTagFilter}
        />
      )}

      {tab === 'experiments' && (
        <EvaluationExperimentsList
          experiments={experiments ?? []}
          datasets={datasets ?? []}
          reviewByExperiment={reviewByExperiment}
          isLoading={isLoadingExperiments}
          search={experimentSearch}
          statusFilter={experimentStatusFilter}
          datasetFilter={experimentDatasetFilter}
        />
      )}
    </>
  );
}
