import type { ClientScoreRowData } from '@mastra/client-js';
import { useTraceSpanScores } from '@mastra/react/hooks/scores';
import { InfoIcon } from 'lucide-react';
import { Fragment, useState } from 'react';
import { DataList } from '../../../ds/components/DataList';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '../../../ds/components/HoverCard';
import { MarkdownRenderer } from '../../../ds/components/MarkdownRenderer';
import { Spinner } from '../../../ds/components/Spinner';
import { Txt } from '../../../ds/components/Txt';
import { ScorersIcon } from '../../../ds/icons/ScorersIcon';

export type TraceScoresListProps = {
  traceId: string;
  spanId: string;
  onScoreSelect: (scoreId: string) => void;
};

/**
 * Scores for the trace's anchor span as a key/value list: one line per scoring, the scorer
 * opening the score and its value on the right. Owns its own pagination: mount it with a `key`
 * on the trace/anchor pair so a page index never leaks across traces.
 */
export function TraceScoresList({ traceId, spanId, onScoreSelect }: TraceScoresListProps) {
  const [page, setPage] = useState(0);
  const { data: scoresData, isLoading } = useTraceSpanScores({
    traceId,
    spanId,
    page,
    queryOptions: { enabled: !!traceId && !!spanId },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-3">
        <Spinner size="md" variant="pulse" className="text-placeholder" />
      </div>
    );
  }

  const scores = scoresData?.scores ?? [];

  if (scores.length === 0) {
    return (
      <Txt variant="caption" tone="muted">
        No scores yet. Score this trace to see results here.
      </Txt>
    );
  }

  const pagination = scoresData?.pagination;
  const currentPage = pagination?.page ?? 0;

  return (
    <div className="grid gap-2">
      <dl className="grid auto-rows-[minmax(1.5rem,auto)] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1">
        {scores.map(score => (
          <TraceScoreLine key={score.id} score={score} onSelect={() => onScoreSelect(score.id)} />
        ))}
      </dl>
      {(currentPage > 0 || pagination?.hasMore) && (
        <DataList.Pagination
          currentPage={currentPage}
          hasMore={pagination?.hasMore}
          onNextPage={() => setPage(currentPage + 1)}
          onPrevPage={() => setPage(currentPage - 1)}
        />
      )}
    </div>
  );
}

function TraceScoreLine({ score, onSelect }: { score: ClientScoreRowData; onSelect: () => void }) {
  const scorerName = String(score.scorer?.name || score.scorerId || 'Scorer');
  const reason = score.reason?.trim();

  return (
    <Fragment>
      <dt className="flex min-w-0 items-center gap-1.5 text-body-sm text-muted-foreground [&>svg]:size-3.5 [&>svg]:shrink-0">
        <ScorersIcon />
        <button
          type="button"
          onClick={onSelect}
          aria-label={`Open ${scorerName} score`}
          className="min-w-0 cursor-pointer truncate text-left hover:text-foreground hover:underline"
        >
          {scorerName}
        </button>
      </dt>
      <dd className="flex min-w-0 items-center justify-end gap-1.5 text-right text-body-sm text-foreground tabular-nums">
        {formatScore(score.score)}
        {reason && (
          <HoverCard>
            <HoverCardTrigger
              delay={0}
              closeDelay={100}
              render={
                <button
                  type="button"
                  aria-label={`Show ${scorerName} reason`}
                  className="cursor-pointer text-muted-foreground hover:text-foreground [&>svg]:size-3.5"
                />
              }
            >
              <InfoIcon />
            </HoverCardTrigger>
            <HoverCardContent side="left" align="start" className="max-h-80 max-w-100 overflow-y-auto">
              <MarkdownRenderer>{reason}</MarkdownRenderer>
            </HoverCardContent>
          </HoverCard>
        )}
      </dd>
    </Fragment>
  );
}

const formatScore = (value: number | null | undefined) => (value != null ? value.toFixed(2) : '-');
