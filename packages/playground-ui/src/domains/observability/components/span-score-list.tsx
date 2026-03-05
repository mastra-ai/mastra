import { EntryList, EntryListSkeleton, getToNextEntryFn, getToPreviousEntryFn } from '@/ds/components/EntryList';
import { ScoreDialog } from '@/domains/scores';
import { useLinkComponent } from '@/lib/framework';
import type { ScoreRowData } from '@mastra/core/evals';
import type { ListScoresResponse, ScoreRecord } from '@mastra/core/storage';
import { isToday, format } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';

export const traceScoresListColumns = [
  { name: 'date', label: 'Date', size: '1fr' },
  { name: 'time', label: 'Time', size: '1fr' },
  { name: 'score', label: 'Score', size: '1fr' },
  { name: 'scorer', label: 'Scorer', size: '1fr' },
];

/** Generate a stable synthetic ID for a ScoreRecord (which has no id field). */
function syntheticScoreId(score: ScoreRecord): string {
  return `${score.scorerId}-${score.timestamp.getTime()}`;
}

/** Map a lean observability ScoreRecord to the shape ScoreDialog expects. */
function toScoreRowData(score: ScoreRecord): ScoreRowData {
  return {
    id: syntheticScoreId(score),
    scorerId: score.scorerId,
    entityId: '',
    runId: '',
    input: undefined,
    output: undefined,
    score: score.score,
    reason: score.reason ?? undefined,
    scorer: { name: score.scorerId, id: score.scorerId },
    metadata: score.metadata as Record<string, unknown> | undefined,
    source: 'LIVE',
    entity: {},
    traceId: score.traceId,
    spanId: score.spanId ?? undefined,
    createdAt: score.timestamp,
    updatedAt: null,
  } as unknown as ScoreRowData;
}

type SpanScoreListProps = {
  scoresData?: ListScoresResponse | null;
  isLoadingScoresData?: boolean;
  initialScoreId?: string;
  traceId?: string;
  spanId?: string;
  onPageChange?: (page: number) => void;
  computeTraceLink: (traceId: string, spanId?: string) => string;
};

export function SpanScoreList({
  scoresData,
  isLoadingScoresData,
  traceId,
  spanId,
  initialScoreId,
  onPageChange,
  computeTraceLink,
}: SpanScoreListProps) {
  const { navigate } = useLinkComponent();
  const [dialogIsOpen, setDialogIsOpen] = useState<boolean>(false);
  const [selectedScore, setSelectedScore] = useState<ScoreRowData | undefined>();

  const mappedScores = useMemo(() => (scoresData?.scores ?? []).map(toScoreRowData), [scoresData?.scores]);

  useEffect(() => {
    if (initialScoreId) {
      handleOnScore(initialScoreId);
    }
  }, [initialScoreId]);

  const handleOnScore = (scoreId: string) => {
    const score = mappedScores.find(s => s.id === scoreId);
    setSelectedScore(score);
    setDialogIsOpen(true);
  };

  if (isLoadingScoresData) {
    return <EntryListSkeleton columns={traceScoresListColumns} />;
  }

  const updateSelectedScore = (scoreId: string) => {
    const score = mappedScores.find(s => s.id === scoreId);
    setSelectedScore(score);
  };

  const toNextScore = getToNextEntryFn({
    entries: mappedScores,
    id: selectedScore?.id,
    update: updateSelectedScore,
  });

  const toPreviousScore = getToPreviousEntryFn({
    entries: mappedScores,
    id: selectedScore?.id,
    update: updateSelectedScore,
  });

  return (
    <>
      <EntryList>
        <EntryList.Trim>
          <EntryList.Header columns={traceScoresListColumns} />
          {mappedScores.length > 0 ? (
            <EntryList.Entries>
              {mappedScores.map(score => {
                const createdAtDate = new Date(score.createdAt);
                const isTodayDate = isToday(createdAtDate);

                const entry = {
                  id: score.id,
                  date: isTodayDate ? 'Today' : format(createdAtDate, 'MMM dd'),
                  time: format(createdAtDate, 'h:mm:ss aaa'),
                  score: score.score,
                  scorer: (score.scorer?.name as string) || (score.scorer?.id as string),
                };

                return (
                  <EntryList.Entry
                    key={score.id}
                    columns={traceScoresListColumns}
                    onClick={() => handleOnScore(score.id)}
                    entry={entry}
                  >
                    {traceScoresListColumns.map(col => {
                      const key = `col-${col.name}`;
                      return (
                        <EntryList.EntryText key={key}>
                          {String(entry?.[col.name as keyof typeof entry] ?? '')}
                        </EntryList.EntryText>
                      );
                    })}
                  </EntryList.Entry>
                );
              })}
            </EntryList.Entries>
          ) : (
            <EntryList.Message message="No scores found" type="info" />
          )}
        </EntryList.Trim>
        <EntryList.Pagination
          currentPage={scoresData?.pagination?.page || 0}
          hasMore={scoresData?.pagination?.hasMore}
          onNextPage={() => onPageChange && onPageChange((scoresData?.pagination?.page || 0) + 1)}
          onPrevPage={() => onPageChange && onPageChange((scoresData?.pagination?.page || 0) - 1)}
        />
      </EntryList>
      <ScoreDialog
        scorerName={(selectedScore?.scorer?.name as string) || (selectedScore?.scorer?.id as string) || ''}
        score={selectedScore}
        isOpen={dialogIsOpen}
        onClose={() => {
          if (traceId) {
            navigate(`${computeTraceLink(traceId, spanId)}&tab=scores`);
          }
          setDialogIsOpen(false);
        }}
        dialogLevel={3}
        onNext={toNextScore}
        onPrevious={toPreviousScore}
        computeTraceLink={(traceId, spanId) => `/observability?traceId=${traceId}${spanId ? `&spanId=${spanId}` : ''}`}
        usageContext="SpanDialog"
      />
    </>
  );
}
