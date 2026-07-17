import type { ClientScoreRowData } from '@mastra/client-js';
import type { ScoreRowData } from '@mastra/core/evals';
import { Button } from '@mastra/playground-ui/components/Button';
import { ScoresDataList, DataListSkeleton } from '@mastra/playground-ui/components/DataList';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Columns3Icon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScoreDataPanel } from '@/domains/traces/components/score-data-panel';

type ToggleableColumn = 'input' | 'entity';

const TOGGLEABLE_COLUMNS: ToggleableColumn[] = ['input', 'entity'];

const COLUMN_LABELS: Record<ToggleableColumn, string> = {
  input: 'Input',
  entity: 'Entity',
};

function buildColumns(visible: Set<ToggleableColumn>): string {
  const parts: string[] = ['auto', 'auto', 'minmax(0, 10rem)'];
  if (visible.has('entity')) parts.push('minmax(0, 14rem)');
  if (visible.has('input')) parts.push('minmax(0, 40rem)');
  return parts.join(' ');
}

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

  const [hiddenColumns, setHiddenColumns] = useState<Set<ToggleableColumn>>(new Set());
  const visibleColumns = useMemo(
    () => new Set<ToggleableColumn>(TOGGLEABLE_COLUMNS.filter(c => !hiddenColumns.has(c))),
    [hiddenColumns],
  );
  const columns = useMemo(() => buildColumns(visibleColumns), [visibleColumns]);

  const toggleColumn = useCallback((col: ToggleableColumn) => {
    setHiddenColumns(prev => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      return next;
    });
  }, []);

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
      <ScoresDataList.TopCell>Date</ScoresDataList.TopCell>
      <ScoresDataList.TopCell>Time</ScoresDataList.TopCell>
      <ScoresDataList.TopCell>Score</ScoresDataList.TopCell>
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

  const hasSidePanel = !!selectedScore;

  return (
    <div
      className={cn('grid h-full min-h-0 gap-4 items-start', hasSidePanel ? 'grid-cols-[1fr_1fr]' : 'grid-cols-[1fr]')}
    >
      <div className="flex flex-col h-full min-h-0 min-w-0 gap-0">
        <div className="flex items-center justify-end pb-2 shrink-0">
          <DropdownMenu>
            <DropdownMenu.Trigger asChild>
              <Button variant="outline" size="sm">
                <Columns3Icon className="size-3.5" />
                Columns
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end">
              <DropdownMenu.Label>Toggle columns</DropdownMenu.Label>
              {TOGGLEABLE_COLUMNS.map(col => (
                <DropdownMenu.CheckboxItem
                  key={col}
                  checked={visibleColumns.has(col)}
                  onClick={() => toggleColumn(col)}
                >
                  {COLUMN_LABELS[col]}
                </DropdownMenu.CheckboxItem>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu>
        </div>

        <ScoresDataList columns={columns} className="flex-1 min-h-0">
          {header}

          {scores.map(score => (
            <ScoresDataList.RowButton
              key={score.id}
              onClick={() => handleScoreClick(score.id)}
              className={selectedScoreId === score.id ? 'bg-surface4' : ''}
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
