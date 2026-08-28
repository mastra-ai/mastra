import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { ScorersIcon } from '@mastra/playground-ui/icons/ScorersIcon';
import { ChevronRightIcon, ExternalLinkIcon } from 'lucide-react';
import { ScoreTraceDialog } from './score-trace-dialog';
import { TraceScoreLineChart } from '@/domains/observability/components/trace-score-line-chart';
import { useTraceSpanScores } from '@/domains/scores/hooks/use-trace-span-scores';
import { useLinkComponent } from '@/lib/framework';

export type TraceScoresCollapsibleProps = {
  traceId: string;
  /** The trace's root span: scores are recorded against it. */
  spanId: string;
  /** Agent scorers only make sense on the top level span of an agent run. */
  isTopLevelSpan?: boolean;
  entityType?: string;
  /** Called once a scorer run is queued, so the caller can send the reader to its results. */
  onScoringStarted?: () => void;
};

/**
 * The scores recorded for one turn of the enriched thread, folded away below it.
 * It is always there, even unscored, because expanding it is how a turn gets scored
 * in the first place — the same dialog the trace page offers.
 *
 * Both halves of a score row are their own destination: the name opens the scorer,
 * the value opens that very score on it. They open in a new tab so the reading
 * position in the thread is never lost.
 */
export function TraceScoresCollapsible({
  traceId,
  spanId,
  isTopLevelSpan,
  entityType,
  onScoringStarted,
}: TraceScoresCollapsibleProps) {
  const { Link, paths } = useLinkComponent();
  const { data } = useTraceSpanScores({ traceId, spanId });
  const scores = data?.scores ?? [];

  return (
    <Collapsible data-testid="trace-scores" className="mt-2">
      <div className="flex items-center justify-between gap-4">
        <CollapsibleTrigger
          className="text-neutral3 hover:text-neutral6 duration-normal text-ui-sm flex cursor-pointer items-center gap-1 font-mono transition-colors"
          data-testid="trace-scores-trigger"
        >
          <ChevronRightIcon className="size-3" />
          {scores.length === 0 ? 'No score' : `${scores.length} ${scores.length === 1 ? 'score' : 'scores'}`}
        </CollapsibleTrigger>

        {/* Scoring a turn does not require reading its scores first, so the action sits
            beside the disclosure rather than inside it. */}
        <ScoreTraceDialog
          traceId={traceId}
          spanId={spanId}
          isTopLevelSpan={isTopLevelSpan}
          entityType={entityType}
          variant="ghost"
          size="sm"
          onScoringStarted={onScoringStarted}
        />
      </div>

      <CollapsibleContent className="pt-2">
        <div className="border-border1 bg-surface3 divide-border1 grid content-start divide-y rounded-lg border">
          {scores.length === 0 && (
            <p className="text-neutral3 text-ui-sm px-3 py-2">This turn has not been scored yet.</p>
          )}

          {scores.length > 0 && (
            <dl className="divide-border1 grid content-start divide-y">
              {scores.map(score => {
                const scorerHref = score.scorerId ? paths.scorerLink(score.scorerId) : undefined;
                const scoreHref =
                  scorerHref && score.entityId
                    ? `${scorerHref}?entity=${encodeURIComponent(score.entityId)}&scoreId=${encodeURIComponent(score.id)}`
                    : undefined;
                const name = score.scorer?.name ?? score.scorerId ?? 'Scorer';

                return (
                  <div key={score.id} className="flex items-center justify-between gap-6 px-3 py-2">
                    <dt className="text-neutral4 text-ui-sm flex min-w-0 items-center gap-1.5">
                      {/* A name alone reads like any other label, so the icon says what it is. */}
                      <Tooltip>
                        <TooltipTrigger className="flex shrink-0 items-center">
                          <ScorersIcon className="size-3" />
                        </TooltipTrigger>
                        <TooltipContent>Scorer</TooltipContent>
                      </Tooltip>

                      {scorerHref ? (
                        <Link
                          href={scorerHref}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-neutral6 duration-normal inline-flex items-center gap-1.5 truncate transition-colors"
                        >
                          {name}
                          <ExternalLinkIcon className="size-3 shrink-0" />
                        </Link>
                      ) : (
                        name
                      )}
                    </dt>

                    <dd className="text-neutral5 text-ui-sm shrink-0 font-mono tabular-nums">
                      {scoreHref ? (
                        <Link
                          href={scoreHref}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-surface5 hover:bg-surface6 hover:text-neutral6 duration-normal inline-flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors"
                        >
                          {score.score}
                          <ExternalLinkIcon className="size-3" />
                        </Link>
                      ) : (
                        score.score
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          )}

          {/* One score is a number, several are a trend: only then is the chart worth the room.
              It shares the list's card, so the card itself has the border and the chart drops its own. */}
          {scores.length > 1 && (
            <TraceScoreLineChart scoresData={data} className="w-full rounded-none border-0 bg-transparent" />
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
