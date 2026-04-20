import type { ClientScoreRowData } from '@mastra/client-js';
import type { ScoreRowData } from '@mastra/core/evals';
import { ScoresDataList, DataListSkeleton, cn } from '@mastra/playground-ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScoreDataPanel } from '@/domains/traces/components/score-data-panel';

const COLUMNS = 'auto auto 1fr auto auto';

type ScoresListProps = {
  selectedScoreId?: string;
  onScoreClick?: (id: string) => void;
  scores?: ClientScoreRowData[];
  isLoading?: boolean;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  setEndOfListElement?: (element: HTMLDivElement | null) => void;
  errorMsg?: string;
};

function mapScore(score: ClientScoreRowData): ScoreRowData {
  return {
    ...score,
    createdAt: new Date(score.createdAt),
    updatedAt: new Date(score.updatedAt),
  };
}

export function ScoresList({
  scores,
  onScoreClick,
  errorMsg,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  setEndOfListElement,
  selectedScoreId: controlledSelectedId,
}: ScoresListProps) {
  const [internalSelectedId, setInternalSelectedId] = useState<string | undefined>(controlledSelectedId);
  const selectedScoreId = controlledSelectedId ?? internalSelectedId;

  // Sync internal selection when parent updates the controlled prop (e.g. browser back clearing ?scoreId)
  useEffect(() => {
    setInternalSelectedId(controlledSelectedId);
  }, [controlledSelectedId]);

  const handleScoreClick = useCallback(
    (id: string) => {
      const nextId = selectedScoreId === id ? undefined : id;
      setInternalSelectedId(nextId);
      onScoreClick?.(nextId ?? '');
    },
    [selectedScoreId, onScoreClick],
  );

  const selectedScore = useMemo(
    () => (selectedScoreId ? scores?.find(s => s.id === selectedScoreId) : undefined),
    [scores, selectedScoreId],
  );

  const selectedIdx = selectedScore ? (scores?.indexOf(selectedScore) ?? -1) : -1;

  const handlePrevious =
    selectedIdx > 0
      ? () => {
          const prev = scores![selectedIdx - 1];
          setInternalSelectedId(prev.id);
          onScoreClick?.(prev.id);
        }
      : undefined;

  const handleNext =
    scores && selectedIdx >= 0 && selectedIdx < scores.length - 1
      ? () => {
          const next = scores[selectedIdx + 1];
          setInternalSelectedId(next.id);
          onScoreClick?.(next.id);
        }
      : undefined;

  const handleClose = useCallback(() => {
    setInternalSelectedId(undefined);
    onScoreClick?.('');
  }, [onScoreClick]);

  if (isLoading) {
    return <DataListSkeleton columns={COLUMNS} />;
  }

  if (!scores) {
    return null;
  }

  const header = (
    <ScoresDataList.Top>
      <ScoresDataList.TopCell>Date</ScoresDataList.TopCell>
      <ScoresDataList.TopCell>Time</ScoresDataList.TopCell>
      <ScoresDataList.TopCell>Input</ScoresDataList.TopCell>
      <ScoresDataList.TopCell>Entity</ScoresDataList.TopCell>
      <ScoresDataList.TopCell>Score</ScoresDataList.TopCell>
    </ScoresDataList.Top>
  );

  if (errorMsg) {
    return (
      <ScoresDataList columns={COLUMNS}>
        {header}
        <ScoresDataList.NoMatch message={errorMsg} />
      </ScoresDataList>
    );
  }

  if (scores.length === 0) {
    return null;
  }

  const hasSidePanel = !!selectedScore;

  return (
    <div
      className={cn('grid h-full min-h-0 gap-4 items-start', hasSidePanel ? 'grid-cols-[1fr_1fr]' : 'grid-cols-[1fr]')}
    >
      <ScoresDataList columns={COLUMNS}>
        {header}

        {scores.map(score => (
          <ScoresDataList.RowButton
            key={score.id}
            onClick={() => handleScoreClick(score.id)}
            className={selectedScoreId === score.id ? 'bg-surface4' : ''}
          >
            <ScoresDataList.DateCell timestamp={score.createdAt} />
            <ScoresDataList.TimeCell timestamp={score.createdAt} />
            <ScoresDataList.InputCell input={score.input} />
            <ScoresDataList.EntityCell entityId={score.entityId} />
            <ScoresDataList.ScoreCell score={score.score} />
          </ScoresDataList.RowButton>
        ))}

        <ScoresDataList.NextPageLoading
          isLoading={isFetchingNextPage}
          hasMore={hasNextPage}
          setEndOfListElement={setEndOfListElement}
        />
      </ScoresDataList>

      {selectedScore && (
        <ScoreDataPanel
          score={mapScore(selectedScore)}
          onClose={handleClose}
          onPrevious={handlePrevious}
          onNext={handleNext}
        />
      )}
    </div>
  );
}
