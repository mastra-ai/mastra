import type { ClientScoreRowData } from '@mastra/client-js';
import type { ExperimentStatus } from '@mastra/core/storage';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { MetricsKpiCard } from '@mastra/playground-ui/components/MetricsKpiCard';
import { ScorersIcon } from '@mastra/playground-ui/icons/ScorersIcon';
import { ExternalLinkIcon, GaugeIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useScorers } from '@/domains/scores/hooks/use-scorers';
import { useLinkComponent } from '@/lib/framework';

export type ExperimentScorerSummaryProps = {
  scoresByItemId?: Record<string, ClientScoreRowData[]>;
  experimentStatus?: ExperimentStatus;
};

export function ExperimentScorerSummary({ scoresByItemId, experimentStatus }: ExperimentScorerSummaryProps) {
  const { Link: LinkComponent, paths } = useLinkComponent();
  const { data: scorers } = useScorers();

  const scorerSummaries = useMemo(() => {
    if (!scoresByItemId) return [];

    const scorerTotals: Record<string, { sum: number; count: number; failed: number }> = {};

    for (const scores of Object.values(scoresByItemId)) {
      for (const score of scores) {
        if (!scorerTotals[score.scorerId]) {
          scorerTotals[score.scorerId] = { sum: 0, count: 0, failed: 0 };
        }
        scorerTotals[score.scorerId].sum += score.score;
        scorerTotals[score.scorerId].count++;
        if (score.score < 1) scorerTotals[score.scorerId].failed++;
      }
    }

    return Object.entries(scorerTotals)
      .map(([scorerId, { sum, count, failed }]) => ({
        scorerId,
        avg: sum / count,
        count,
        failed,
      }))
      .sort((a, b) => a.scorerId.localeCompare(b.scorerId));
  }, [scoresByItemId]);

  if (scorerSummaries.length === 0) {
    const isRunning = experimentStatus === 'running' || experimentStatus === 'pending';
    const hasLoadedScores = scoresByItemId !== undefined;

    let title: string;
    let description: string;

    if (isRunning) {
      title = 'Experiment in progress';
      description = 'Summary metrics will appear here once the experiment completes.';
    } else if (!hasLoadedScores) {
      title = 'Loading scores';
      description = 'Fetching scorer results…';
    } else {
      title = 'No scorers configured';
      description = 'Add scorers when triggering an experiment to evaluate results and see summary metrics here.';
    }

    return (
      <div className="flex h-full items-center justify-center py-12">
        <EmptyState
          iconSlot={<GaugeIcon className="text-neutral3 h-8 w-8" />}
          titleSlot={title}
          descriptionSlot={description}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap content-start gap-3">
      {scorerSummaries.map(({ scorerId, avg, count, failed }) => {
        const scorerName = scorers?.[scorerId]?.scorer?.config?.name ?? scorerId;

        return (
          <MetricsKpiCard key={scorerId} className="max-w-96">
            <LinkComponent
              href={paths.scorerLink(scorerId)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ui-md text-neutral3 [&>svg]:text-neutral3 flex min-w-0 items-center gap-1.5 leading-relaxed hover:underline [&>svg]:size-3.5 [&>svg]:shrink-0"
            >
              <ScorersIcon />
              <span className="truncate">{scorerName}</span>
              <ExternalLinkIcon />
            </LinkComponent>
            <strong className="text-header-lg text-neutral4 font-semibold">
              <span className={failed === 0 ? 'text-accent1' : 'text-error'}>{failed}</span>
              <span className="text-neutral3">/{count}</span>
              <span className="text-ui-md text-neutral3 ml-1.5 font-normal">failed</span>
            </strong>
            <MetricsKpiCard.Label className="text-ui-sm text-neutral2">
              {`Avg score ${avg.toFixed(3)}`}
            </MetricsKpiCard.Label>
          </MetricsKpiCard>
        );
      })}
    </div>
  );
}
