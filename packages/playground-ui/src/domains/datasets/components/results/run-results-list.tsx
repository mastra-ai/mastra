import { Check, X } from 'lucide-react';
import { DatasetRunResult } from '@mastra/client-js';
import { ItemList } from '@/ds/components/ItemList';
import { Badge } from '@/ds/components/Badge';

export type RunResultsListProps = {
  results: DatasetRunResult[];
  isLoading: boolean;
};

export type RunResultsListInternalProps = {
  results: DatasetRunResult[];
  isLoading: boolean;
  selectedResultId: string | null;
  onResultClick: (resultId: string) => void;
};

const resultsListColumns = [
  { name: 'itemId', label: 'Item ID', size: '10rem' },
  { name: 'output', label: 'Output', size: '1fr' },
  { name: 'latency', label: 'Latency', size: '10rem' },
  { name: 'status', label: 'Status', size: '3rem' },
  { name: 'error', label: 'Error', size: '3rem' },
];

/**
 * Internal list component - controlled by parent for selection state.
 * Used by RunResultsMasterDetail.
 */
export function RunResultsListInternal({
  results,
  isLoading,
  selectedResultId,
  onResultClick,
}: RunResultsListInternalProps) {
  if (isLoading) {
    return <RunResultsListSkeleton />;
  }

  if (results.length === 0) {
    return <div className="text-neutral4 text-sm text-center py-8">No results yet</div>;
  }

  return (
    <ItemList>
      <ItemList.Header columns={resultsListColumns}>
        {resultsListColumns.map(col => (
          <ItemList.HeaderCol key={col.name}>{col.label}</ItemList.HeaderCol>
        ))}
      </ItemList.Header>

      <ItemList.Scroller>
        <ItemList.Items>
          {results.map(result => {
            const hasError = Boolean(result.error);
            const entry = { id: result.id };
            const isSelected = result.id === selectedResultId;

            return (
              <ItemList.Row key={result.id} isSelected={isSelected}>
                <ItemList.RowButton
                  entry={entry}
                  isSelected={isSelected}
                  columns={resultsListColumns}
                  onClick={() => onResultClick(result.id)}
                >
                  <ItemList.ItemText>{result.itemId}</ItemList.ItemText>
                  <ItemList.ItemText>{truncate(formatValue(result.output), 200)}</ItemList.ItemText>
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
                  <ItemList.ItemText>{result.error ? truncate(result.error, 30) : '-'}</ItemList.ItemText>
                </ItemList.RowButton>
              </ItemList.Row>
            );
          })}
        </ItemList.Items>
      </ItemList.Scroller>
    </ItemList>
  );
}

/**
 * Main export - uses RunResultsMasterDetail for the column layout.
 * This is the component to use on pages.
 */
export { RunResultsMasterDetail as RunResultsList } from './run-results-master-detail';

/** Skeleton loader for results list */
function RunResultsListSkeleton() {
  return (
    <ItemList>
      <ItemList.Header columns={resultsListColumns}>
        {resultsListColumns.map(col => (
          <ItemList.HeaderCol key={col.name}>{col.label}</ItemList.HeaderCol>
        ))}
      </ItemList.Header>
      <ItemList.Items>
        {Array.from({ length: 5 }).map((_, index) => (
          <ItemList.Row key={index}>
            <ItemList.RowButton columns={resultsListColumns}>
              {resultsListColumns.map((_, colIndex) => (
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
