import type { DatasetExperiment } from '@mastra/client-js';
import { HorizontalBars, MetricsCard } from '@mastra/playground-ui';
import { useMemo } from 'react';
import { CHART_COLORS } from '@/domains/metrics/components/metrics-utils';

interface DatasetHealthCardProps {
  experiments?: DatasetExperiment[];
  isLoading: boolean;
  isError: boolean;
}

export function DatasetHealthCard({ experiments, isLoading, isError }: DatasetHealthCardProps) {
  const { barData, maxVal, segments } = useMemo(() => {
    if (!experiments || experiments.length === 0) {
      return { barData: [], maxVal: 0, segments: [] };
    }

    // Group by target → count distinct datasets per target type
    const targetMap = new Map<
      string,
      { targetType: string; agentDatasets: Set<string>; workflowDatasets: Set<string>; scorerDatasets: Set<string> }
    >();

    for (const exp of experiments) {
      const key = exp.targetId;
      if (!targetMap.has(key)) {
        targetMap.set(key, {
          targetType: exp.targetType,
          agentDatasets: new Set(),
          workflowDatasets: new Set(),
          scorerDatasets: new Set(),
        });
      }
      const entry = targetMap.get(key)!;
      const dsId = exp.datasetId ?? 'unknown';
      if (exp.targetType === 'agent') entry.agentDatasets.add(dsId);
      else if (exp.targetType === 'workflow') entry.workflowDatasets.add(dsId);
      else entry.scorerDatasets.add(dsId);
    }

    const segs = [
      { label: 'Agent datasets', color: CHART_COLORS.blue },
      { label: 'Workflow datasets', color: CHART_COLORS.purple },
      { label: 'Scorer datasets', color: CHART_COLORS.orange },
    ];

    const bars = Array.from(targetMap.entries())
      .map(([targetId, entry]) => ({
        name: targetId,
        values: [entry.agentDatasets.size, entry.workflowDatasets.size, entry.scorerDatasets.size],
      }))
      .filter(b => b.values.some(v => v > 0));

    const max = bars.reduce(
      (m, b) =>
        Math.max(
          m,
          b.values.reduce((a, v) => a + v, 0),
        ),
      0,
    );

    return { barData: bars, maxVal: max, segments: segs };
  }, [experiments]);

  const hasData = barData.length > 0;

  return (
    <MetricsCard>
      <MetricsCard.TopBar>
        <MetricsCard.TitleAndDescription
          title="Dataset Coverage by Target"
          description="Number of distinct datasets used to evaluate each target."
        />
      </MetricsCard.TopBar>
      {isLoading ? (
        <MetricsCard.Loading />
      ) : isError ? (
        <MetricsCard.Error message="Failed to load experiment data" />
      ) : (
        <MetricsCard.Content>
          {!hasData ? (
            <MetricsCard.NoData message="No experiments have been run yet" />
          ) : (
            <HorizontalBars
              data={barData}
              segments={segments}
              maxVal={maxVal}
              fmt={(n: number) => `${n} dataset${n !== 1 ? 's' : ''}`}
            />
          )}
        </MetricsCard.Content>
      )}
    </MetricsCard>
  );
}
