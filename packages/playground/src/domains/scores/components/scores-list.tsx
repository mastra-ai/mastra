import type { ClientScoreRowData } from '@mastra/client-js';
import { ScoresDataList, DataListSkeleton, useDataListKeyboard } from '@mastra/playground-ui/components/DataList';
import type { DataListSort } from '@mastra/playground-ui/components/DataList';
import type { ListSort } from '@mastra/playground-ui/sort/sort-by';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ScoresColumnsState } from '@/domains/scores/hooks/use-scores-columns';
import { ScoreDataPanel } from '@/domains/traces/components/score-data-panel';

type ScoresListProps = {
  selectedScoreId?: string;
  onScoreClick?: (id: string) => void;
  scores?: ClientScoreRowData[];
  isLoading?: boolean;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  setEndOfListElement?: (element: HTMLDivElement | null) => void;
  errorMsg?: string;
  columnsState: ScoresColumnsState;
  sort?: ListSort<ScoresSortKey>;
  onSortChange?: (sort: DataListSort, key: string) => void;
};

export type ScoresSortKey = 'date' | 'score';

export function ScoresList({
  scores,
  onScoreClick,
  errorMsg,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  setEndOfListElement,
  selectedScoreId: controlledSelectedId,
  columnsState: { visibleColumns, columns },
  sort,
  onSortChange,
}: ScoresListProps) {
  const [internalSelectedId, setInternalSelectedId] = useState<string | undefined>(controlledSelectedId);
  const selectedScoreId = controlledSelectedId ?? internalSelectedId;

  // Sync internal selection when parent updates the controlled prop
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

  const { containerRef, getRowProps } = useDataListKeyboard({ count: scores?.length ?? 0 });

  const handleClose = useCallback(() => {
    setInternalSelectedId(undefined);
    onScoreClick?.('');
  }, [onScoreClick]);

  if (isLoading) {
    return <DataListSkeleton columns={columns} />;
  }

  if (!scores) {
    return null;
  }

  const header = (
    <ScoresDataList.Top>
      {onSortChange ? (
        <ScoresDataList.SortableTopCell
          sortKey="date"
          sort={sort?.key === 'date' ? sort.direction : undefined}
          onSortChange={onSortChange}
        >
          Date
        </ScoresDataList.SortableTopCell>
      ) : (
        <ScoresDataList.TopCell>Date</ScoresDataList.TopCell>
      )}
      <ScoresDataList.TopCell>Time</ScoresDataList.TopCell>
      {onSortChange ? (
        <ScoresDataList.SortableTopCell
          sortKey="score"
          sort={sort?.key === 'score' ? sort.direction : undefined}
          onSortChange={onSortChange}
        >
          Score
        </ScoresDataList.SortableTopCell>
      ) : (
        <ScoresDataList.TopCell>Score</ScoresDataList.TopCell>
      )}
      {visibleColumns.has('entity') && <ScoresDataList.TopCell>Entity</ScoresDataList.TopCell>}
      {visibleColumns.has('input') && <ScoresDataList.TopCell>Input</ScoresDataList.TopCell>}
    </ScoresDataList.Top>
  );

  if (errorMsg) {
    return (
      <ScoresDataList columns={columns}>
        {header}
        <ScoresDataList.NoMatch message={errorMsg} />
      </ScoresDataList>
    );
  }

  if (scores.length === 0) {
    return null;
  }

  return (
    <>
      <div className="flex h-full min-h-0 min-w-0 flex-col">
        <ScoresDataList columns={columns} className="min-h-0" scrollRef={containerRef}>
          {header}

          {scores.map((score, index) => (
            <ScoresDataList.RowButton
              key={score.id}
              onClick={() => handleScoreClick(score.id)}
              className={selectedScoreId === score.id ? 'bg-fill-hover' : ''}
              {...getRowProps(index)}
            >
              <ScoresDataList.DateCell timestamp={score.createdAt} />
              <ScoresDataList.TimeCell timestamp={score.createdAt} />
              <ScoresDataList.ScoreCell score={score.score} />
              {visibleColumns.has('entity') && <ScoresDataList.EntityCell entityId={score.entityId} />}
              {visibleColumns.has('input') && <ScoresDataList.InputCell input={score.input} />}
            </ScoresDataList.RowButton>
          ))}

          <ScoresDataList.NextPageLoading
            isLoading={isFetchingNextPage}
            hasMore={hasNextPage}
            setEndOfListElement={setEndOfListElement}
          />
        </ScoresDataList>
      </div>

      <ScoreDataPanel score={selectedScore} onClose={handleClose} onPrevious={handlePrevious} onNext={handleNext} />
    </>
  );
}
