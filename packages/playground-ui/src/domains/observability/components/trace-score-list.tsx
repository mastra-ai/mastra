import { EntryList, getShortId } from '@/components/ui/elements';
import { ScoreDialog, useScoreById } from '@/domains/scores';
import { ClientScoreRowData } from '@mastra/client-js';
import { isToday, format } from 'date-fns';
import { useEffect, useState } from 'react';
import { set } from 'zod';

export const traceScoresListColumns = [
  { name: 'shortId', label: 'ID', size: '1fr' },
  { name: 'date', label: 'Date', size: '1fr' },
  { name: 'time', label: 'Time', size: '1fr' },
  { name: 'score', label: 'Score', size: '1fr' },
  { name: 'scorer', label: 'Scorer', size: '1fr' },
];

type ScoreLink = {
  // type: string;
  scoreId: string;
  scorerName: string;
  score: number;
  createdAt: string;
};

type TraceScoreListProps = {
  scores: Array<ScoreLink>;
};

type SelectedScore = (ScoreLink & Partial<ClientScoreRowData>) | undefined;

export function TraceScoreList({ scores }: TraceScoreListProps) {
  const [dialogIsOpen, setDialogIsOpen] = useState<boolean>(false);
  const [selectedScore, setSelectedScore] = useState<SelectedScore | undefined>();
  const [selectedScoreId, setSelectedScoreId] = useState<string | undefined>();

  const { score: scoreDetails, isLoading: isLoadingScoreDetails } = useScoreById(selectedScoreId || '');

  const orderedScores = (scores || []).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  useEffect(() => {
    if (scoreDetails) {
      if (scoreDetails?.id === selectedScore?.scoreId && !selectedScore?.input) {
        setSelectedScore(prev => {
          return { ...prev, ...scoreDetails } as SelectedScore;
        });
      }
    }
  }, [scoreDetails, selectedScoreId]);

  const handleOnScore = (scoreId: string) => {
    setSelectedScoreId(scoreId);

    if (selectedScore?.scoreId !== scoreId) {
      const simplifiedScore = scores.find(s => s.scoreId === scoreId);

      if (simplifiedScore) {
        setSelectedScore(simplifiedScore);
      }
    }

    setDialogIsOpen(true);
  };

  return (
    <>
      <EntryList>
        <EntryList.Trim>
          <EntryList.Header columns={traceScoresListColumns} />
          {orderedScores.length > 0 ? (
            <EntryList.Entries>
              {orderedScores?.map(score => {
                const createdAtDate = new Date(score.createdAt);
                const isTodayDate = isToday(createdAtDate);

                const entry = {
                  id: score?.scoreId,
                  shortId: getShortId(score?.scoreId) || 'n/a',
                  date: isTodayDate ? 'Today' : format(createdAtDate, 'MMM dd'),
                  time: format(createdAtDate, 'h:mm:ss aaa'),
                  score: score?.score,
                  scorer: score?.scorerName,
                };

                return (
                  <EntryList.Entry
                    key={score.scoreId}
                    columns={traceScoresListColumns}
                    //  onClick={() => onScore(score.scorerName)}
                    onClick={() => handleOnScore(score.scoreId)}
                    entry={entry}
                  >
                    {(traceScoresListColumns || []).map(col => {
                      const key = `col-${col.name}`;
                      return (
                        <EntryList.EntryText key={key}>{entry?.[col.name as keyof typeof entry]}</EntryList.EntryText>
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
      </EntryList>
      <ScoreDialog
        scorerName={selectedScore?.scorerName || ''}
        score={selectedScore as ClientScoreRowData}
        isOpen={dialogIsOpen}
        onClose={() => setDialogIsOpen(false)}
        dialogLevel={2}
        //    onNext={toNextScore}
        //    onPrevious={toPreviousScore}
        computeTraceLink={(traceId, spanId) => `/observability?traceId=${traceId}${spanId ? `&spanId=${spanId}` : ''}`}
      />
    </>
  );
}
