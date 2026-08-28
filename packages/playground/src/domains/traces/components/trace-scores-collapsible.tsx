import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { ChevronRightIcon, ExternalLinkIcon } from 'lucide-react';

import { useTraceSpanScores } from '@/domains/scores/hooks/use-trace-span-scores';
import { useLinkComponent } from '@/lib/framework';

export type TraceScoresCollapsibleProps = {
  traceId: string;
  /** The trace's root span: scores are recorded against it. */
  spanId: string;
};

/**
 * The scores recorded for one turn of the enriched thread, folded away below it.
 * Renders nothing when the trace was never scored, or when scoring is unavailable,
 * so unscored conversations read exactly as before.
 *
 * Both halves of a row are their own destination: the name opens the scorer, the
 * value opens that very score on it. They open in a new tab so the reading position
 * in the thread is never lost.
 */
export function TraceScoresCollapsible({ traceId, spanId }: TraceScoresCollapsibleProps) {
  const { Link, paths } = useLinkComponent();
  const { data } = useTraceSpanScores({ traceId, spanId });
  const scores = data?.scores ?? [];

  if (scores.length === 0) return null;

  return (
    <Collapsible data-testid="trace-scores" className="mt-2">
      <CollapsibleTrigger
        className="text-neutral3 hover:text-neutral6 duration-normal text-ui-sm flex cursor-pointer items-center gap-1 font-mono transition-colors"
        data-testid="trace-scores-trigger"
      >
        <ChevronRightIcon className="size-3" />
        {scores.length} {scores.length === 1 ? 'score' : 'scores'}
      </CollapsibleTrigger>

      <CollapsibleContent className="pt-2">
        <dl className="border-border1 bg-surface3 divide-border1 grid content-start divide-y rounded-lg border">
          {scores.map(score => {
            const scorerHref = score.scorerId ? paths.scorerLink(score.scorerId) : undefined;
            const scoreHref =
              scorerHref && score.entityId
                ? `${scorerHref}?entity=${encodeURIComponent(score.entityId)}&scoreId=${encodeURIComponent(score.id)}`
                : undefined;
            const name = score.scorer?.name ?? score.scorerId ?? 'Scorer';

            return (
              <div key={score.id} className="flex items-center justify-between gap-6 px-3 py-2">
                <dt className="text-neutral4 text-ui-sm min-w-0">
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
      </CollapsibleContent>
    </Collapsible>
  );
}
