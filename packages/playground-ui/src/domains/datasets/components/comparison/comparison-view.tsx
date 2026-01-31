import { Alert, AlertTitle, AlertDescription } from '@/ds/components/Alert';
import { Table, Thead, Th, Tbody, Row, TxtCell, Cell } from '@/ds/components/Table';
import { ScrollableContainer } from '@/ds/components/ScrollableContainer';
import { Skeleton } from '@/ds/components/Skeleton';
import { Spinner } from '@/ds/components/Spinner';
import { ScoreDelta } from './score-delta';
import { useCompareRuns } from '../../hooks/use-compare-runs';

interface ComparisonViewProps {
  datasetId: string;
  runIdA: string;
  runIdB: string;
}

/**
 * Side-by-side comparison of two dataset runs.
 * Shows version mismatch warning, per-scorer stats, and per-item score deltas.
 */
export function ComparisonView({ datasetId, runIdA, runIdB }: ComparisonViewProps) {
  const { data: comparison, isLoading, error } = useCompareRuns(datasetId, runIdA, runIdB);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error loading comparison</AlertTitle>
        <AlertDescription as="p">{error instanceof Error ? error.message : 'Unknown error'}</AlertDescription>
      </Alert>
    );
  }

  if (!comparison) {
    return <div className="text-neutral4 text-sm text-center py-8">No comparison data</div>;
  }

  const scorerIds = Object.keys(comparison.scorers);

  return (
    <div className="space-y-6">
      {/* Version mismatch warning */}
      {comparison.versionMismatch && (
        <Alert variant="warning">
          <AlertTitle>Version mismatch</AlertTitle>
          <AlertDescription as="p">
            These runs used different dataset versions. Results may not be directly comparable.
          </AlertDescription>
        </Alert>
      )}

      {/* Other warnings */}
      {comparison.warnings.map((warning, i) => (
        <Alert key={i} variant="info">
          <AlertDescription as="p">{warning}</AlertDescription>
        </Alert>
      ))}

      {/* Regression summary */}
      {comparison.hasRegression && (
        <Alert variant="destructive">
          <AlertTitle>Regression detected</AlertTitle>
          <AlertDescription as="p">One or more scorers showed regression compared to the baseline.</AlertDescription>
        </Alert>
      )}

      {/* Per-scorer summary */}
      <section>
        <h3 className="text-sm font-medium text-neutral5 mb-3">Scorer Summary</h3>
        <ScrollableContainer className="max-h-64">
          <Table size="small">
            <Thead className="sticky top-0">
              <Th>Scorer</Th>
              <Th>Run A (Baseline)</Th>
              <Th>Run B</Th>
              <Th>Delta</Th>
              <Th>Status</Th>
            </Thead>
            <Tbody>
              {scorerIds.map(scorerId => {
                const scorer = comparison.scorers[scorerId];
                return (
                  <Row key={scorerId}>
                    <TxtCell>{scorerId}</TxtCell>
                    <TxtCell>{scorer.statsA.avgScore.toFixed(3)}</TxtCell>
                    <TxtCell>{scorer.statsB.avgScore.toFixed(3)}</TxtCell>
                    <Cell>
                      <ScoreDelta delta={scorer.delta} regressed={scorer.regressed} />
                    </Cell>
                    <Cell>
                      {scorer.regressed ? (
                        <span className="text-red-500 text-sm">Regressed</span>
                      ) : scorer.delta > 0 ? (
                        <span className="text-green-500 text-sm">Improved</span>
                      ) : (
                        <span className="text-neutral4 text-sm">No change</span>
                      )}
                    </Cell>
                  </Row>
                );
              })}
            </Tbody>
          </Table>
        </ScrollableContainer>
      </section>

      {/* Per-item comparison */}
      <section>
        <h3 className="text-sm font-medium text-neutral5 mb-3">
          Per-Item Comparison ({comparison.items.length} items)
        </h3>
        <ScrollableContainer className="max-h-96">
          <Table size="small">
            <Thead className="sticky top-0">
              <Th>Item ID</Th>
              <Th>In Both</Th>
              {scorerIds.map(scorerId => (
                <Th key={scorerId}>{scorerId}</Th>
              ))}
            </Thead>
            <Tbody>
              {comparison.items.map(item => (
                <Row key={item.itemId}>
                  <TxtCell>{truncate(item.itemId, 16)}</TxtCell>
                  <Cell>
                    {item.inBothRuns ? (
                      <span className="text-green-500 text-sm">Yes</span>
                    ) : (
                      <span className="text-amber-500 text-sm">No</span>
                    )}
                  </Cell>
                  {scorerIds.map(scorerId => {
                    const scoreA = item.scoresA[scorerId];
                    const scoreB = item.scoresB[scorerId];
                    const delta = scoreA !== null && scoreB !== null ? scoreB - scoreA : null;

                    return (
                      <Cell key={scorerId}>
                        {delta !== null ? (
                          <div className="flex items-center gap-2">
                            <span className="text-neutral4 text-xs">
                              {scoreA?.toFixed(2)} → {scoreB?.toFixed(2)}
                            </span>
                            <ScoreDelta delta={delta} regressed={comparison.scorers[scorerId]?.regressed ?? false} />
                          </div>
                        ) : (
                          <span className="text-neutral4 text-sm">-</span>
                        )}
                      </Cell>
                    );
                  })}
                </Row>
              ))}
            </Tbody>
          </Table>
        </ScrollableContainer>
      </section>
    </div>
  );
}

/** Truncate string to max length */
function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + '...';
}
