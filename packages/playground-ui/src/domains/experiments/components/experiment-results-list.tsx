import type { ClientScoreRowData, DatasetExperimentResult } from '@mastra/client-js';
import { ItemList } from '@/ds/components/ItemList';

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
  if (isLoading) {
    return <ExperimentResultsListSkeleton columns={columns} />;
  }

  if (results.length === 0) {
    return <div className="text-neutral4 text-sm text-center py-8">No results yet</div>;
  }

  return (
    <ItemList>
      <ItemList.Header columns={columns}>
        {columns?.map(col => (
          <ItemList.HeaderCol key={col.name}>{col.label}</ItemList.HeaderCol>
        ))}
      </ItemList.Header>

      <ItemList.Scroller>
        <ItemList.Items>
          {results.map(result => {
            const hasError = Boolean(result.error);
            const entry = { id: result.id };
            const isSelected = result.id === featuredResultId;

            return (
              <ItemList.Row key={result.id}>
                <ItemList.RowButton
                  item={entry}
                  isFeatured={isSelected}
                  columns={columns}
                  onClick={() => onResultClick(result.id)}
                >
                  <ItemList.IdCell id={result.itemId} />
                  <ItemList.StatusCell status={hasError ? 'error' : 'success'} />

                  {columns.some(col => col.name === 'input') && (
                    <ItemList.TextCell className="font-mono">
                      {truncate(formatValue(result.input), 200)}
                    </ItemList.TextCell>
                  )}
                  {scorerIds?.map(scorerId => {
                    const scores = scoresByItemId?.[result.itemId];
                    const score = scores?.find(s => s.scorerId === scorerId);
                    return (
                      <ItemList.TextCell key={scorerId} className="font-mono text-center">
                        {score != null ? score.score.toFixed(3) : '-'}
                      </ItemList.TextCell>
                    );
                  })}
                </ItemList.RowButton>
              </ItemList.Row>
            );
          })}
        </ItemList.Items>
        <ItemList.NextPageLoading
          setEndOfListElement={setEndOfListElement}
          isLoading={isFetchingNextPage}
          hasMore={hasNextPage}
          loadingText="Loading more results..."
          noMoreDataText="All results loaded"
        />
      </ItemList.Scroller>
    </ItemList>
  );
}

/** Skeleton loader for results list */
function ExperimentResultsListSkeleton({ columns }: { columns: { name: string; label: string; size: string }[] }) {
  return (
    <ItemList>
      <ItemList.Header columns={columns}>
        {columns.map(col => (
          <ItemList.HeaderCol key={col.name}>{col.label}</ItemList.HeaderCol>
        ))}
      </ItemList.Header>
      <ItemList.Items>
        {Array.from({ length: 5 }).map((_, index) => (
          <ItemList.Row key={index}>
            <ItemList.RowButton columns={columns}>
              {columns.map((_, colIndex) => (
                <ItemList.TextCell key={colIndex} isLoading>
                  Loading...
                </ItemList.TextCell>
              ))}
            </ItemList.RowButton>
          </ItemList.Row>
        ))}
      </ItemList.Items>
    </ItemList>
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
