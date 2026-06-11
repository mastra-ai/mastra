import type { ClientScoreRowData, DatasetExperimentResult } from '@mastra/client-js';
import { Chip, DataList, DataListSkeleton, Tooltip, TooltipContent, TooltipTrigger, cn } from '@mastra/playground-ui';
import { classifyReplayDivergence, getToolReplayReport } from '../utils/tool-replay';

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
  /** Renders the per-row divergence cell — must match a 'replay' entry in `columns`. */
  showReplayColumn?: boolean;
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
  showReplayColumn,
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

                {showReplayColumn && (
                  <DataList.Cell height="compact">
                    <ReplayDivergenceCell result={result} />
                  </DataList.Cell>
                )}

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

/**
 * Worst divergence signal of one replayed result. Clean runs render nothing —
 * the absence of a chip is the good news.
 */
function ReplayDivergenceCell({ result }: { result: DatasetExperimentResult }) {
  const report = getToolReplayReport(result);
  if (!report) return null;
  const divergence = classifyReplayDivergence(report);
  if (divergence === 'clean') return null;
  if (divergence === 'failed-expectations') {
    return <Chip color="red">expectation</Chip>;
  }
  if (divergence === 'misses') {
    return <Chip color="orange">{`${report.misses.length} miss${report.misses.length > 1 ? 'es' : ''}`}</Chip>;
  }
  if (divergence === 'arg-mismatches') {
    return <Chip color="yellow">{`${report.argMismatches.length} args`}</Chip>;
  }
  const unconsumedCount = report.unconsumed.reduce((sum, entry) => sum + entry.count, 0);
  return <Chip color="blue">{`${unconsumedCount} unconsumed`}</Chip>;
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
