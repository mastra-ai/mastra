import type { ClientScoreRowData, DatasetExperimentResult } from '@mastra/client-js';
import { EntityList, Spinner, Tooltip, TooltipContent, TooltipTrigger, Txt, cn } from '@mastra/playground-ui';

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
}: ExperimentResultsListProps) {
  const gridColumns = columns.map(c => c.size).join(' ');

  if (isLoading) {
    return (
      <EntityList columns={gridColumns}>
        <EntityList.Top>
          {columns.map(col => (
            <EntityList.TopCell key={col.name}>{col.label}</EntityList.TopCell>
          ))}
        </EntityList.Top>
        <div className="flex items-center justify-center py-20 col-span-full">
          <Spinner />
        </div>
      </EntityList>
    );
  }

  if (results.length === 0) {
    return (
      <EntityList columns={gridColumns}>
        <EntityList.Top>
          {columns.map(col => (
            <EntityList.TopCell key={col.name}>{col.label}</EntityList.TopCell>
          ))}
        </EntityList.Top>
        <EntityList.NoMatch message="No results yet" />
      </EntityList>
    );
  }

  return (
    <EntityList columns={gridColumns}>
      <EntityList.Top>
        {columns.map(col => (
          <EntityList.TopCell key={col.name}>{col.label}</EntityList.TopCell>
        ))}
      </EntityList.Top>

      <EntityList.Rows>
        {results.map(result => {
          const hasError = Boolean(result.error);
          const isSelected = result.id === featuredResultId;

          return (
            <EntityList.Row key={result.id} onClick={() => onResultClick(result.id)} selected={isSelected}>
              <EntityList.TextCell>
                <span className="truncate block font-mono">{result.itemId}</span>
              </EntityList.TextCell>
              <EntityList.Cell>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center justify-center w-10 relative bg-transparent h-full">
                      <div className={cn('w-2 h-2 rounded-full', hasError ? 'bg-red-700' : 'bg-green-600')} />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>{hasError ? 'Error' : 'Success'}</TooltipContent>
                </Tooltip>
              </EntityList.Cell>

              {columns.some(col => col.name === 'input') && (
                <EntityList.TextCell>
                  <span className="truncate block font-mono">{truncate(formatValue(result.input), 200)}</span>
                </EntityList.TextCell>
              )}
              {scorerIds?.map(scorerId => {
                const scores = scoresByItemId?.[result.itemId];
                const score = scores?.find(s => s.scorerId === scorerId);
                return (
                  <EntityList.TextCell key={scorerId}>
                    <span className="font-mono">{score != null ? score.score.toFixed(3) : '-'}</span>
                  </EntityList.TextCell>
                );
              })}
            </EntityList.Row>
          );
        })}

        <div ref={setEndOfListElement} className="h-1 col-span-full">
          {isFetchingNextPage && (
            <div className="flex justify-center py-4">
              <Spinner />
            </div>
          )}
          {!hasNextPage && results.length > 0 && (
            <Txt variant="ui-xs" className="text-icon3 text-center py-4 block">
              All results loaded
            </Txt>
          )}
        </div>
      </EntityList.Rows>
    </EntityList>
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
