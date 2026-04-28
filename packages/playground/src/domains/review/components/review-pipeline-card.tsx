import type { DatasetExperiment, DatasetRecord, ExperimentReviewCounts } from '@mastra/client-js';
import { HorizontalBars, MetricsCard } from '@mastra/playground-ui';
import { useMemo } from 'react';

const REVIEW_COLORS = {
  needsReview: '#facc15',
  complete: '#22c55e',
};

// "complete" is the DB status value; we label it "Reviewed" in the UI for clarity
const SEGMENTS = [
  { label: 'Needs Review', color: REVIEW_COLORS.needsReview },
  { label: 'Reviewed', color: REVIEW_COLORS.complete },
];

interface ReviewPipelineCardProps {
  reviewSummary?: { counts: ExperimentReviewCounts[] };
  experiments?: DatasetExperiment[];
  datasets?: DatasetRecord[];
  isLoading: boolean;
  isError: boolean;
}

export function ReviewPipelineCard({
  reviewSummary,
  experiments,
  datasets,
  isLoading,
  isError,
}: ReviewPipelineCardProps) {
  const { data, maxVal, totalInPipeline } = useMemo(() => {
    if (!reviewSummary?.counts || !experiments) return { data: [], maxVal: 0, totalInPipeline: 0 };

    const expMap = new Map<string, DatasetExperiment>();
    for (const exp of experiments) {
      expMap.set(exp.id, exp);
    }

    const dsMap = new Map<string, string>();
    if (datasets) {
      for (const ds of datasets) {
        dsMap.set(ds.id, ds.name);
      }
    }

    let max = 0;
    let pipeline = 0;
    const barData: Array<{ name: string; values: number[] }> = [];

    for (const c of reviewSummary.counts) {
      const inPipeline = c.needsReview + c.complete;
      if (inPipeline === 0) continue;

      pipeline += inPipeline;
      if (inPipeline > max) max = inPipeline;

      const exp = expMap.get(c.experimentId);
      const dsName = exp?.datasetId ? dsMap.get(exp.datasetId) : undefined;
      const label = dsName ? `${dsName} · ${c.experimentId.slice(0, 8)}` : c.experimentId.slice(0, 8);

      barData.push({
        name: label,
        values: [c.needsReview, c.complete],
      });
    }

    return { data: barData, maxVal: max, totalInPipeline: pipeline };
  }, [reviewSummary, experiments, datasets]);

  const hasData = data.length > 0;

  return (
    <MetricsCard>
      <MetricsCard.TopBar>
        <MetricsCard.TitleAndDescription title="Review Pipeline" description="Items in review across experiments." />
        {hasData && <MetricsCard.Summary value={String(totalInPipeline)} label="Items in pipeline" />}
      </MetricsCard.TopBar>
      {isLoading ? (
        <MetricsCard.Loading />
      ) : isError ? (
        <MetricsCard.Error message="Failed to load review data" />
      ) : (
        <MetricsCard.Content>
          {!hasData ? (
            <MetricsCard.NoData message="No items have been sent to review yet" />
          ) : (
            <HorizontalBars data={data} segments={SEGMENTS} maxVal={maxVal} fmt={v => String(v)} />
          )}
        </MetricsCard.Content>
      )}
    </MetricsCard>
  );
}
