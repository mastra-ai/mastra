import { Check, X } from 'lucide-react';
import { DatasetRunResult } from '@mastra/client-js';
import { EntryList } from '@/ds/components/EntryList';
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
    <EntryList>
      <EntryList.Trim>
        <EntryList.Header columns={resultsListColumns} />
        <EntryList.Entries>
          {results.map((result: DatasetRunResult) => {
            const hasError = Boolean(result.error);
            const entry = { id: result.id };
            const isSelected = result.id === selectedResultId;

            return (
              <EntryList.Entry
                key={result.id}
                entry={entry}
                isSelected={isSelected}
                columns={resultsListColumns}
                onClick={() => onResultClick(result.id)}
              >
                <EntryList.EntryText>{result.itemId}</EntryList.EntryText>
                <EntryList.EntryText>{truncate(formatValue(result.output), 200)}</EntryList.EntryText>
                <EntryList.EntryText>{Math.floor(result.latency)} ms</EntryList.EntryText>
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
                <EntryList.EntryText>{result.error ? truncate(result.error, 30) : '-'}</EntryList.EntryText>
              </EntryList.Entry>
            );
          })}
        </EntryList.Entries>
      </EntryList.Trim>
    </EntryList>
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
    <EntryList>
      <EntryList.Trim>
        <EntryList.Header columns={resultsListColumns} />
        <EntryList.Entries>
          {Array.from({ length: 5 }).map((_: unknown, index: number) => (
            <EntryList.Entry key={index} columns={resultsListColumns}>
              {resultsListColumns.map((_col: { name: string; label: string; size: string }, colIndex: number) => (
                <EntryList.EntryText key={colIndex} isLoading>
                  Loading...
                </EntryList.EntryText>
              ))}
            </EntryList.Entry>
          ))}
        </EntryList.Entries>
      </EntryList.Trim>
    </EntryList>
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
