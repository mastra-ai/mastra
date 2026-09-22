import type { ClientScoreRowData, ListScoresResponse } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { DataList } from '@mastra/playground-ui/components/DataList';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { MetricsKpiCard } from '@mastra/playground-ui/components/MetricsKpiCard';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { getShortId } from '@mastra/playground-ui/components/Text';
import { format, isToday } from 'date-fns';
import { CircleSlashIcon, ExternalLinkIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { useTraceSpanScores } from '@/domains/scores/hooks/use-trace-span-scores';

const REASON_PREVIEW_LENGTH = 100;

type TraceScoresTabProps = {
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
  const { data: scoresData, isLoading } = useTraceSpanScores({ traceId, spanId, page });

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Spinner size="md" variant="pulse" className="text-placeholder" />
      </div>
    );
  }

  const scores = scoresData?.scores ?? [];

  if (scores.length === 0) {
    return (
      <EmptyState
        iconSlot={<CircleSlashIcon />}
        titleSlot="No scores yet"
        descriptionSlot="Score this trace to see results here."
      />
    );
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
    <MetricsKpiCard className="min-w-0">
      <button
        type="button"
        onClick={onSelect}
        aria-label={`Score ${getShortId(score.id)}`}
        className="grid gap-1 text-left"
      >
        <MetricsKpiCard.Label>{scorerName}</MetricsKpiCard.Label>
        <MetricsKpiCard.Value>{String(score.score)}</MetricsKpiCard.Value>
        <span className="text-ui-xs text-muted-foreground font-mono">
          {getShortId(score.id)} · {isToday(createdAt) ? 'Today' : format(createdAt, 'MMM dd')}{' '}
          {format(createdAt, 'h:mm:ss aaa')}
        </span>
      </button>
      {score.reason && <TraceScoreReason reason={score.reason} />}
      <Button
        as={Link}
        to={`/scorers/${score.scorerId}?scoreId=${score.id}`}
        variant="ghost"
        size="sm"
        className="-ml-2 justify-self-start"
        icon={<ExternalLinkIcon />}
      >
        Open scorer run
      </Button>
    </MetricsKpiCard>
  );
}

function TraceScoreReason({ reason }: { reason: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = reason.length > REASON_PREVIEW_LENGTH;
  const text = isLong && !expanded ? `${reason.slice(0, REASON_PREVIEW_LENGTH).trimEnd()}…` : reason;

  return (
    <p className="text-ui-sm text-placeholder">
      {text}
      {isLong && (
        <>
          {' '}
          <button
            type="button"
            onClick={() => setExpanded(value => !value)}
            className="text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          >
            {expanded ? 'Read less' : 'Read more'}
          </button>
        </>
      )}
    </p>
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
