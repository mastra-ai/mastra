import type { ClientScoreRowData } from '@mastra/client-js';
import type { ExperimentStatus } from '@mastra/core/storage';
import { MetricsKpiCard } from '@mastra/playground-ui/components/MetricsKpiCard';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { ScorersIcon } from '@mastra/playground-ui/icons/ScorersIcon';
import { GaugeIcon } from 'lucide-react';
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

    const scorerTotals: Record<string, { sum: number; count: number }> = {};

    for (const scores of Object.values(scoresByItemId)) {
      for (const score of scores) {
        if (!scorerTotals[score.scorerId]) {
          scorerTotals[score.scorerId] = { sum: 0, count: 0 };
        }
        scorerTotals[score.scorerId].sum += score.score;
        scorerTotals[score.scorerId].count++;
      }
    }

    return Object.entries(scorerTotals)
      .map(([scorerId, { sum, count }]) => ({
        scorerId,
        avg: sum / count,
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
      <div className="text-ui-sm text-neutral3 flex items-center gap-2">
        <GaugeIcon className="text-neutral3 size-4 shrink-0" />
        <span className="text-neutral4">{title}</span>
        <span className="truncate">{description}</span>
      </div>
    );
  }

  return (
    <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
      {scorerSummaries.map(({ scorerId, avg }) => {
        const scorerName = scorers?.[scorerId]?.scorer?.config?.name ?? scorerId;

        return (
          <MetricsKpiCard key={scorerId} className="w-52 min-w-0 flex-none p-3">
            <LinkComponent
              href={paths.scorerLink(scorerId)}
              className="text-ui-sm text-neutral3 [&>svg]:text-neutral3 flex min-w-0 items-center gap-1.5 hover:underline [&>svg]:size-3 [&>svg]:shrink-0"
            >
              <Tooltip>
                <TooltipTrigger render={<ScorersIcon role="img" aria-label="Scorer" />} />
                <TooltipContent>Scorer</TooltipContent>
              </Tooltip>
              <span className="truncate">{scorerName}</span>
            </LinkComponent>
            <strong className="text-ui-lg text-neutral4 font-semibold">
              {avg.toFixed(3)}
              <span className="text-ui-sm text-neutral3 ml-1.5 font-normal">avg score</span>
            </strong>
          </MetricsKpiCard>
        );
      })}
    </div>
  );
}
