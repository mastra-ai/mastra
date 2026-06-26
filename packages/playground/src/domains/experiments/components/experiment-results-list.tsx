import type { ClientScoreRowData, DatasetExperimentResult } from '@mastra/client-js';
import { DataList, DataListSkeleton } from '@mastra/playground-ui/components/DataList';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { cn } from '@mastra/playground-ui/utils/cn';

export type ExperimentResultsListProps = {
  results: DatasetExperimentResult[];
  isLoading: boolean;
  featuredResultId: string | null;
  onResultClick: (resultId: string) => void;
  columns: { name: string; label: string; size: string }[];
  scoresByItemId?: Record<string, ClientScoreRowData[]>;
  scorerIds?: string[];
  setEndOfListElement?: (element: HTMLDivElement | null) => void;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (resultId: string) => void;
};

/**
 * List component for experiment results - controlled by parent for selection state.
 */
export function ExperimentResultsList({
  results,
  isLoading,
  featuredResultId,
  onResultClick,
  columns,
  scoresByItemId,
  scorerIds,
  setEndOfListElement,
  isFetchingNextPage,
  hasNextPage,
  selectedIds,
  onToggleSelect,
}: ExperimentResultsListProps) {
  const hasSelection = Boolean(selectedIds && onToggleSelect);
  const gridColumns = [hasSelection ? 'auto' : '', ...columns.map(c => c.size)].filter(Boolean).join(' ');
  const hasInputColumn = columns.some(col => col.name === 'input');

  if (isLoading) {
    return <DataListSkeleton columns={gridColumns} />;
  }

  return (
    <DataList columns={gridColumns} className="min-w-0">
      <DataList.Top hasLeadingCell={hasSelection}>
        {hasSelection && <DataList.TopCell>&nbsp;</DataList.TopCell>}
        {hasSelection ? (
          <DataList.TopCells colStart={2}>
            {columns.map(col => (
              <DataList.TopCell key={col.name}>{col.label}</DataList.TopCell>
            ))}
          </DataList.TopCells>
        ) : (
          columns.map(col => <DataList.TopCell key={col.name}>{col.label}</DataList.TopCell>)
        )}
      </DataList.Top>

      {results.length === 0 ? (
        <DataList.NoMatch message="No results yet" />
      ) : (
        <>
          {results.map(result => {
            const hasError = Boolean(result.error);
            const isFeatured = result.id === featuredResultId;

            const rowCells = (
              <>
                <DataList.IdCell id={result.itemId} />
                <DataList.Cell height="compact">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center justify-center w-10 relative bg-transparent h-full">
                        <div
                          role="img"
                          aria-label={hasError ? 'Error' : 'Success'}
                          className={cn('w-2 h-2 rounded-full', hasError ? 'bg-red-700' : 'bg-green-600')}
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>{hasError ? 'Error' : 'Success'}</TooltipContent>
                  </Tooltip>
                </DataList.Cell>

                {hasInputColumn && <DataList.MonoCell>{truncate(formatValue(result.input), 200)}</DataList.MonoCell>}

                {scorerIds?.map(scorerId => {
                  const scores = scoresByItemId?.[result.itemId];
                  const score = scores?.find(s => s.scorerId === scorerId);
                  return (
                    <DataList.Cell key={scorerId} height="compact" className="font-mono text-neutral3 text-ui-smd">
                      {score != null ? score.score.toFixed(3) : '-'}
                    </DataList.Cell>
                  );
                })}
              </>
            );

            if (!hasSelection) {
              return (
                <DataList.RowButton key={result.id} featured={isFeatured} onClick={() => onResultClick(result.id)}>
                  {rowCells}
                </DataList.RowButton>
              );
            }

            return (
              <DataList.RowWrapper key={result.id}>
                <DataList.SelectCell
                  checked={selectedIds!.has(result.id)}
                  onToggle={() => onToggleSelect!(result.id)}
                  aria-label={`Select result ${result.itemId}`}
                />
                <DataList.RowButton
                  flushLeft
                  colStart={2}
                  featured={isFeatured}
                  onClick={() => onResultClick(result.id)}
                >
                  {rowCells}
                </DataList.RowButton>
              </DataList.RowWrapper>
            );
          })}

          <DataList.NextPageLoading
            isLoading={isFetchingNextPage}
            hasMore={hasNextPage}
            setEndOfListElement={setEndOfListElement}
          />
        </>
      )}
    </DataList>
  );
}

/** Format unknown value for display */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

/** Truncate string to max length */
function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + '...';
}
