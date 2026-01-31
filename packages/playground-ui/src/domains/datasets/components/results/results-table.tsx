import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { Table, Thead, Th, Tbody, Row, TxtCell, Cell } from '@/ds/components/Table';
import { Badge } from '@/ds/components/Badge';
import { Skeleton } from '@/ds/components/Skeleton';
import { ScrollableContainer } from '@/ds/components/ScrollableContainer';
import { ResultDetailDialog } from './result-detail-dialog';
import { getToNextEntryFn, getToPreviousEntryFn } from '@/ds/components/EntryList/helpers';

/**
 * Parse scores defensively - handles array, JSON string, or invalid values.
 * API may return scores as JSON string if storage layer doesn't parse it.
 */
function parseScores(scores: unknown): ScoreData[] {
  if (Array.isArray(scores)) return scores;
  if (typeof scores === 'string') {
    try {
      const parsed = JSON.parse(scores);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

// Score data type embedded in result
export interface ScoreData {
  id?: string;
  scorerId: string;
  scorerName?: string;
  score: number | null;
  reason?: string | null;
  error?: string | null;
}

// Run result type (simplified for UI, matching core/storage)
export interface RunResultData {
  id: string;
  runId: string;
  itemId: string;
  itemVersion: Date;
  input: unknown;
  output: unknown | null;
  expectedOutput: unknown | null;
  latency: number;
  error: string | null;
  startedAt: Date;
  completedAt: Date;
  retryCount: number;
  /** Trace ID from agent/workflow execution */
  traceId?: string | null;
  /** Scores from scorers applied during run */
  scores: ScoreData[];
  createdAt: Date;
}

export interface ResultsTableProps {
  results: RunResultData[];
  isLoading: boolean;
}

/**
 * Table displaying per-item results from a dataset run.
 * Clicking a row opens a detail dialog with full input/output/scores.
 */
export function ResultsTable({ results, isLoading }: ResultsTableProps) {
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);

  const selectedResult = results.find(r => r.id === selectedResultId);

  const handleRowClick = (resultId: string) => {
    setSelectedResultId(resultId);
  };

  const handleCloseDialog = () => {
    setSelectedResultId(null);
  };

  const toNextResult = getToNextEntryFn({
    entries: results,
    id: selectedResultId ?? undefined,
    update: (id: string | undefined) => setSelectedResultId(id ?? null),
  });

  const toPreviousResult = getToPreviousEntryFn({
    entries: results,
    id: selectedResultId ?? undefined,
    update: (id: string | undefined) => setSelectedResultId(id ?? null),
  });

  if (isLoading) {
    return <ResultsTableSkeleton />;
  }

  if (results.length === 0) {
    return <div className="text-neutral4 text-sm text-center py-8">No results yet</div>;
  }

  return (
    <>
      <ScrollableContainer>
        <Table>
          <Thead className="sticky top-0">
            <Th>Item ID</Th>
            <Th>Input</Th>
            <Th>Output</Th>
            <Th>Scores</Th>
            <Th>Status</Th>
            <Th>Error</Th>
          </Thead>
          <Tbody>
            {results.map(result => {
              // Defensive: parse scores (may be array, JSON string, or invalid)
              const itemScores = parseScores(result.scores);
              const hasError = result.error !== null;
              const scoresDisplay = itemScores
                .filter(s => s.score !== null)
                .map(s => `${s.scorerId}: ${s.score}`)
                .join(', ');

              return (
                <Row
                  key={result.id}
                  onClick={() => handleRowClick(result.id)}
                  selected={result.id === selectedResultId}
                >
                  <TxtCell>{truncate(result.itemId, 16)}</TxtCell>
                  <TxtCell>{truncate(formatValue(result.input), 40)}</TxtCell>
                  <TxtCell>{truncate(formatValue(result.output), 40)}</TxtCell>
                  <TxtCell>{scoresDisplay || '-'}</TxtCell>
                  <Cell>
                    {hasError ? (
                      <Badge variant="error">
                        <X className="w-3 h-3" />
                      </Badge>
                    ) : (
                      <Badge variant="success">
                        <Check className="w-3 h-3" />
                      </Badge>
                    )}
                  </Cell>
                  <TxtCell>{result.error ? truncate(result.error, 30) : '-'}</TxtCell>
                </Row>
              );
            })}
          </Tbody>
        </Table>
      </ScrollableContainer>

      {selectedResult && (
        <ResultDetailDialog
          result={selectedResult}
          scores={parseScores(selectedResult.scores)}
          isOpen={Boolean(selectedResultId)}
          onClose={handleCloseDialog}
          onNext={toNextResult}
          onPrevious={toPreviousResult}
        />
      )}
    </>
  );
}

/** Skeleton loader for results table */
function ResultsTableSkeleton() {
  return (
    <Table>
      <Thead>
        <Th>Item ID</Th>
        <Th>Input</Th>
        <Th>Output</Th>
        <Th>Scores</Th>
        <Th>Status</Th>
        <Th>Error</Th>
      </Thead>
      <Tbody>
        {Array.from({ length: 5 }).map((_, i) => (
          <Row key={i}>
            <Cell>
              <Skeleton className="h-4 w-24" />
            </Cell>
            <Cell>
              <Skeleton className="h-4 w-32" />
            </Cell>
            <Cell>
              <Skeleton className="h-4 w-32" />
            </Cell>
            <Cell>
              <Skeleton className="h-4 w-20" />
            </Cell>
            <Cell>
              <Skeleton className="h-4 w-8" />
            </Cell>
            <Cell>
              <Skeleton className="h-4 w-24" />
            </Cell>
          </Row>
        ))}
      </Tbody>
    </Table>
  );
}

/** Format unknown value for display */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

/** Truncate string to max length */
function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + '...';
}
