import { useMemo } from 'react';
import { Alert, AlertTitle, AlertDescription } from '@/ds/components/Alert';
import { Table, Thead, Th, Tbody, Row, TxtCell, Cell } from '@/ds/components/Table';
import { ScrollableContainer } from '@/ds/components/ScrollableContainer';
import { Spinner } from '@/ds/components/Spinner';
import { ScoreDelta } from './score-delta';
import { useCompareExperiments } from '../../hooks/use-compare-experiments';
import { useDatasetExperiment } from '../../hooks/use-dataset-experiments';
import type { CompareExperimentsResponse } from '@mastra/client-js';
import { Notice } from '@/ds/components/Notice';
import { AlertTriangleIcon } from 'lucide-react';

interface ComparisonViewProps {
  datasetId: string;
  experimentIdA: string;
  experimentIdB: string;
}

/**
 * Side-by-side comparison of two dataset experiments.
 * Shows version mismatch warning and per-item score deltas.
 */
export function ComparisonView({ datasetId, experimentIdA, experimentIdB }: ComparisonViewProps) {
  const { data, isLoading, error } = useCompareExperiments(datasetId, experimentIdA, experimentIdB);
  const comparison = data as CompareExperimentsResponse | undefined;

  const { data: expA } = useDatasetExperiment(datasetId, experimentIdA);
  const { data: expB } = useDatasetExperiment(datasetId, experimentIdB);

  const versionMismatch = expA && expB && expA.datasetVersion !== expB.datasetVersion;

  // Collect all unique scorer IDs across all items
  const scorerIds = useMemo(() => {
    if (!comparison) return [];
    const ids = new Set<string>();
    for (const item of comparison.items) {
      for (const result of Object.values(item.results)) {
        if (result) {
          for (const key of Object.keys(result.scores)) {
            ids.add(key);
          }
        }
      }
    }
    return [...ids].sort();
  }, [comparison]);

  // Compute per-scorer average deltas
  const scorerSummaries = useMemo(() => {
    if (!comparison || scorerIds.length === 0) return [];
    const baselineId = comparison.baselineId;
    const otherId = experimentIdA === baselineId ? experimentIdB : experimentIdA;

    return scorerIds.map(scorerId => {
      let sumA = 0;
      let sumB = 0;
      let countA = 0;
      let countB = 0;

      for (const item of comparison.items) {
        const scoreA = item.results[baselineId]?.scores[scorerId];
        const scoreB = item.results[otherId]?.scores[scorerId];
        if (scoreA != null) {
          sumA += scoreA;
          countA++;
        }
        if (scoreB != null) {
          sumB += scoreB;
          countB++;
        }
      }

      const avgA = countA > 0 ? sumA / countA : null;
      const avgB = countB > 0 ? sumB / countB : null;
      const delta = avgA != null && avgB != null ? avgB - avgA : null;

      return { scorerId, avgA, avgB, delta };
    });
  }, [comparison, scorerIds, experimentIdA, experimentIdB]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <Notice variant="warning">
        <AlertTriangleIcon />
        <Notice.Column>
          <Notice.Title>Error loading comparison</Notice.Title>
          <Notice.Message>{error instanceof Error ? error.message : 'Unknown error'}</Notice.Message>
        </Notice.Column>
      </Notice>
    );
  }

  if (!comparison || comparison.items.length === 0) {
    return <div className="text-neutral4 text-sm text-center py-8">No comparison data</div>;
  }

  const baselineId = comparison.baselineId;
  const otherId = experimentIdA === baselineId ? experimentIdB : experimentIdA;

  return (
    <div className="space-y-6">
      {versionMismatch && (
        <Notice variant="warning">
          <AlertTriangleIcon />
          <Notice.Message>
            <strong>Version mismatch!</strong> These experiments used different dataset versions (v
            {expA.datasetVersion} vs v{expB.datasetVersion}). Results may not be directly comparable.
          </Notice.Message>
        </Notice>
      )}

      {/* Per-scorer summary */}
      {scorerSummaries.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-neutral5 mb-3">Scorer Summary</h3>
          <ScrollableContainer className="max-h-64">
            <Table size="small">
              <Thead className="sticky top-0">
                <Th>Scorer</Th>
                <Th>Baseline Avg</Th>
                <Th>Comparison Avg</Th>
                <Th>Delta</Th>
              </Thead>
              <Tbody>
                {scorerSummaries.map(({ scorerId, avgA, avgB, delta }) => (
                  <Row key={scorerId}>
                    <TxtCell>{scorerId}</TxtCell>
                    <TxtCell>{avgA != null ? avgA.toFixed(3) : '-'}</TxtCell>
                    <TxtCell>{avgB != null ? avgB.toFixed(3) : '-'}</TxtCell>
                    <Cell>
                      {delta != null ? <ScoreDelta delta={delta} /> : <span className="text-neutral4 text-sm">-</span>}
                    </Cell>
                  </Row>
                ))}
              </Tbody>
            </Table>
          </ScrollableContainer>
        </section>
      )}

      {/* Per-item comparison */}
      <section>
        <h3 className="text-sm font-medium text-neutral5 mb-3">
          Per-Item Comparison ({comparison.items.length} items)
        </h3>
        <ScrollableContainer className="max-h-[70vh]">
          <Table size="small">
            <Thead className="sticky top-0">
              <Th>Item ID</Th>
              <Th>In Both</Th>
              {scorerIds.map(id => (
                <Th key={id}>{id}</Th>
              ))}
            </Thead>
            <Tbody>
              {comparison.items.map(item => {
                const resultA = item.results[baselineId];
                const resultB = item.results[otherId];
                const inBoth = Boolean(resultA && resultB);

                return (
                  <Row key={item.itemId}>
                    <TxtCell>{truncate(item.itemId, 16)}</TxtCell>
                    <Cell>
                      {inBoth ? (
                        <span className="text-green-500 text-sm">Yes</span>
                      ) : (
                        <span className="text-amber-500 text-sm">No</span>
                      )}
                    </Cell>
                    {scorerIds.map(scorerId => {
                      const scoreA = resultA?.scores[scorerId] ?? null;
                      const scoreB = resultB?.scores[scorerId] ?? null;
                      const delta = scoreA != null && scoreB != null ? scoreB - scoreA : null;

                      return (
                        <Cell key={scorerId}>
                          {delta != null ? (
                            <div className="flex items-center gap-2">
                              <span className="text-neutral4 text-xs">
                                {scoreA?.toFixed(2)} → {scoreB?.toFixed(2)}
                              </span>
                              <ScoreDelta delta={delta} />
                            </div>
                          ) : (
                            <span className="text-neutral4 text-sm">-</span>
                          )}
                        </Cell>
                      );
                    })}
                  </Row>
                );
              })}
            </Tbody>
          </Table>
        </ScrollableContainer>
      </section>
    </div>
  );
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + '...';
}
