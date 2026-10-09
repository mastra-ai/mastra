import type { ClientScoreRowData, ListScoresResponse } from '@mastra/client-js';
import { useTraceSpanScores } from '@mastra/react/hooks/scores';
import { useState } from 'react';
import { DataList } from '@/ds/components/DataList';
import { EmptyState } from '@/ds/components/EmptyState';
import { MetricsKpiCard } from '@/ds/components/MetricsKpiCard';
import { Spinner } from '@/ds/components/Spinner';
import { getShortId } from '@/ds/components/Text';
import { Txt } from '@/ds/components/Txt';
import { controlStateColorTransition } from '@/ds/primitives/transitions';
import { quietTextHover } from '@/ds/primitives/typography';
import { cn } from '@/utils/cn';
import { formatDate } from '@/utils/date-format';

const REASON_PREVIEW_LENGTH = 100;

export type TraceScoresTabProps = {
  traceId: string;
  spanId: string;
  onScoreSelect: (scoreId: string) => void;
};

/**
 * Scores for the trace's anchor span, one card per scoring. Owns its own pagination:
 * mount it with a `key` on the trace/anchor pair so a page index never leaks across traces.
 */
export function TraceScoresTab({ traceId, spanId, onScoreSelect }: TraceScoresTabProps) {
  const [page, setPage] = useState(0);
  const { data: scoresData, isLoading } = useTraceSpanScores({
    traceId,
    spanId,
    page,
    queryOptions: { enabled: !!traceId && !!spanId },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Spinner size="md" variant="pulse" className="text-placeholder" />
      </div>
    );
  }

  const scores = scoresData?.scores ?? [];

  if (scores.length === 0) {
    return <EmptyState titleSlot="No scores yet" descriptionSlot="Score this trace to see results here." />;
  }

  return (
    <div className="grid content-start gap-3">
      {scores.map(score => (
        <TraceScoreCard key={score.id} score={score} onSelect={() => onScoreSelect(score.id)} />
      ))}
      <TraceScoresPagination pagination={scoresData?.pagination} onPageChange={setPage} />
    </div>
  );
}

function TraceScoreCard({ score, onSelect }: { score: ClientScoreRowData; onSelect: () => void }) {
  const createdAt = new Date(score.createdAt);
  const scorerName = String(score.scorer?.name || score.scorer?.id || 'Scorer');

  return (
    <MetricsKpiCard className="relative min-w-0 cursor-pointer">
      <button
        type="button"
        onClick={onSelect}
        aria-label={`Score ${getShortId(score.id)}`}
        className="grid cursor-pointer gap-1 text-left after:absolute after:inset-0 after:content-['']"
      >
        <MetricsKpiCard.Label>{scorerName}</MetricsKpiCard.Label>
        <MetricsKpiCard.Value>{String(score.score)}</MetricsKpiCard.Value>
        <Txt as="span" variant="meta" tone="muted" className="tabular-nums">
          <Txt as="span" variant="meta" font="mono">
            {getShortId(score.id)}
          </Txt>{' '}
          · {formatDate(createdAt, 'date-time-seconds')}
        </Txt>
      </button>
      {score.reason && <TraceScoreReason reason={score.reason} />}
    </MetricsKpiCard>
  );
}

function TraceScoreReason({ reason }: { reason: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = reason.length > REASON_PREVIEW_LENGTH;
  const text = isLong && !expanded ? `${reason.slice(0, REASON_PREVIEW_LENGTH).trimEnd()}…` : reason;

  return (
    <Txt variant="caption" tone="faint">
      {text}
      {isLong && (
        <>
          {' '}
          <button
            type="button"
            onClick={() => setExpanded(value => !value)}
            className={cn(quietTextHover, controlStateColorTransition, 'relative z-10 underline underline-offset-2')}
          >
            <Txt as="span" variant="caption">
              {expanded ? 'Read less' : 'Read more'}
            </Txt>
          </button>
        </>
      )}
    </Txt>
  );
}

function TraceScoresPagination({
  pagination,
  onPageChange,
}: {
  pagination?: ListScoresResponse['pagination'];
  onPageChange: (page: number) => void;
}) {
  const currentPage = pagination?.page ?? 0;
  if (currentPage === 0 && !pagination?.hasMore) return null;

  return (
    <DataList.Pagination
      currentPage={currentPage}
      hasMore={pagination?.hasMore}
      onNextPage={() => onPageChange(currentPage + 1)}
      onPrevPage={() => onPageChange(currentPage - 1)}
    />
  );
}
