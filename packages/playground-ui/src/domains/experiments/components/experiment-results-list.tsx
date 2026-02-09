import { Check, X } from 'lucide-react';
import { DatasetRunResult } from '@mastra/client-js';
import { ItemList } from '@/ds/components/ItemList';
import { Badge } from '@/ds/components/Badge';

export type ExperimentResultsListProps = {
  results: DatasetRunResult[];
  isLoading: boolean;
  featuredResultId: string | null;
  onResultClick: (resultId: string) => void;
  columns: { name: string; label: string; size: string }[];
};

// const resultsListColumns = [
//   { name: 'itemId', label: 'Item ID', size: '5rem' },
//   { name: 'output', label: 'Output', size: '1fr' },
//   { name: 'latency', label: 'Latency', size: '6rem' },
//   { name: 'status', label: 'Status', size: '3rem' },
// ];

/**
 * List component for experiment results - controlled by parent for selection state.
 * Used by ExperimentResultsListAndDetails.
 */
export function ExperimentResultsList({
  results,
  isLoading,
  featuredResultId,
  onResultClick,
  columns,
}: ExperimentResultsListProps) {
  if (isLoading) {
    return <ExperimentResultsListSkeleton columns={columns} />;
  }

  if (results.length === 0) {
    return <div className="text-neutral4 text-sm text-center py-8">No results yet</div>;
  }

  // const resultsListColumns = [
  //   { name: 'itemId', label: 'Item ID', size: '5rem' },
  //   { name: 'output', label: 'Output', size: '1fr' },
  //   { name: 'latency', label: 'Latency', size: '6rem' },
  //   { name: 'status', label: 'Status', size: '3rem' },
  // ];

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
              <ItemList.Row key={result.id} isSelected={isSelected}>
                <ItemList.RowButton
                  entry={entry}
                  isSelected={isSelected}
                  columns={columns}
                  onClick={() => onResultClick(result.id)}
                >
                  <ItemList.ItemText>{result.itemId.slice(0, 8)}</ItemList.ItemText>
                  {columns.some(col => col.name === 'output') && (
                    <ItemList.ItemText>{truncate(formatValue(result.output), 200)}</ItemList.ItemText>
                  )}
                  <ItemList.ItemText>{Math.floor(result.latency)} ms</ItemList.ItemText>
                  <div>
                    {hasError ? (
                      <Badge variant="error">
                        <X className="w-3 h-3" />
                      </Badge>
                    ) : (
                      <Badge variant="success">
                        <Check className="w-3 h-3" />
                      </Badge>
                    )}
                  </div>
                </ItemList.RowButton>
              </ItemList.Row>
            );
          })}
        </ItemList.Items>
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
                <ItemList.ItemText key={colIndex} isLoading>
                  Loading...
                </ItemList.ItemText>
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
