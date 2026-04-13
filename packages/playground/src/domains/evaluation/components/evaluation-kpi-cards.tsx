import type { DatasetExperiment, DatasetRecord, GetScorerResponse } from '@mastra/client-js';
import { MetricsKpiCard } from '@mastra/playground-ui';

interface EvaluationKpiCardsProps {
  scorers?: Record<string, GetScorerResponse>;
  datasets?: DatasetRecord[];
  experiments?: DatasetExperiment[];
  avgScore?: number | null;
  prevAvgScore?: number | null;
  totalNeedsReview?: number;
  isLoadingScorers: boolean;
  isLoadingDatasets: boolean;
  isLoadingExperiments: boolean;
  isLoadingScores: boolean;
  isLoadingReview?: boolean;
}

function computeExperimentComparison(experiments?: DatasetExperiment[]) {
  if (!experiments || experiments.length < 2) return null;

  const sorted = [...experiments].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const mid = Math.floor(sorted.length / 2);
  const prevCount = mid;
  const currCount = sorted.length - mid;

  if (prevCount === 0) return null;

  const changePct = ((currCount - prevCount) / prevCount) * 100;
  return { changePct: Math.round(changePct * 10) / 10, prevValue: String(prevCount) };
}

export function EvaluationKpiCards({
  scorers,
  datasets,
  experiments,
  avgScore,
  prevAvgScore,
  totalNeedsReview,
  isLoadingScorers,
  isLoadingDatasets,
  isLoadingExperiments,
  isLoadingScores,
  isLoadingReview,
}: EvaluationKpiCardsProps) {
  const totalScorers = scorers ? Object.keys(scorers).length : undefined;
  const totalDatasets = datasets?.length;
  const totalExperiments = experiments?.length;

  const avgScoreChange =
    avgScore != null && prevAvgScore != null && prevAvgScore !== 0
      ? {
          changePct: Math.round(((avgScore - prevAvgScore) / prevAvgScore) * 100 * 10) / 10,
          prevValue: String(prevAvgScore),
        }
      : null;

  const expComparison = computeExperimentComparison(experiments);

  return (
    <>
      <MetricsKpiCard>
        <MetricsKpiCard.Label>Total Scorers</MetricsKpiCard.Label>
        {isLoadingScorers ? (
          <MetricsKpiCard.Loading />
        ) : totalScorers != null ? (
          <>
            <MetricsKpiCard.Value>{String(totalScorers)}</MetricsKpiCard.Value>
            <MetricsKpiCard.NoChange message="Static count" />
          </>
        ) : (
          <MetricsKpiCard.NoData />
        )}
      </MetricsKpiCard>

      <MetricsKpiCard>
        <MetricsKpiCard.Label>Total Datasets</MetricsKpiCard.Label>
        {isLoadingDatasets ? (
          <MetricsKpiCard.Loading />
        ) : totalDatasets != null ? (
          <>
            <MetricsKpiCard.Value>{String(totalDatasets)}</MetricsKpiCard.Value>
            <MetricsKpiCard.NoChange message="Static count" />
          </>
        ) : (
          <MetricsKpiCard.NoData />
        )}
      </MetricsKpiCard>

      <MetricsKpiCard>
        <MetricsKpiCard.Label>Avg Score</MetricsKpiCard.Label>
        {isLoadingScores ? (
          <MetricsKpiCard.Loading />
        ) : avgScore != null ? (
          <>
            <MetricsKpiCard.Value>{String(avgScore)}</MetricsKpiCard.Value>
            {avgScoreChange ? (
              <MetricsKpiCard.Change changePct={avgScoreChange.changePct} prevValue={avgScoreChange.prevValue} />
            ) : (
              <MetricsKpiCard.NoChange />
            )}
          </>
        ) : (
          <MetricsKpiCard.NoData />
        )}
      </MetricsKpiCard>

      <MetricsKpiCard>
        <MetricsKpiCard.Label>Total Experiments</MetricsKpiCard.Label>
        {isLoadingExperiments ? (
          <MetricsKpiCard.Loading />
        ) : totalExperiments != null ? (
          <>
            <MetricsKpiCard.Value>{String(totalExperiments)}</MetricsKpiCard.Value>
            {expComparison ? (
              <MetricsKpiCard.Change changePct={expComparison.changePct} prevValue={expComparison.prevValue} />
            ) : (
              <MetricsKpiCard.NoChange />
            )}
          </>
        ) : (
          <MetricsKpiCard.NoData />
        )}
      </MetricsKpiCard>

      <MetricsKpiCard>
        <MetricsKpiCard.Label>Needs Review</MetricsKpiCard.Label>
        {isLoadingReview ? (
          <MetricsKpiCard.Loading />
        ) : totalNeedsReview != null ? (
          <>
            <MetricsKpiCard.Value>{String(totalNeedsReview)}</MetricsKpiCard.Value>
            {totalNeedsReview > 0 ? (
              <MetricsKpiCard.NoChange message="items pending review" />
            ) : (
              <MetricsKpiCard.NoChange message="All caught up" />
            )}
          </>
        ) : (
          <MetricsKpiCard.NoData />
        )}
      </MetricsKpiCard>
    </>
  );
}
