import type { DatasetExperiment, DatasetRecord } from '@mastra/client-js';
import { Cell, EntryCell, Row, Table, Tbody, Th, Thead } from '@/ds/components/Table';
import { PermissionDenied } from '@/ds/components/PermissionDenied';
import { is403ForbiddenError } from '@/lib/query-utils';
import { Badge } from '@/ds/components/Badge';
import { useMemo, useState } from 'react';

import { ScrollableContainer } from '@/ds/components/ScrollableContainer';
import { Skeleton } from '@/ds/components/Skeleton';
import { useLinkComponent } from '@/lib/framework';
import { Searchbar, SearchbarWrapper } from '@/ds/components/Searchbar';
import { EmptyDatasetsTable } from '@/domains/datasets/components/empty-datasets-table';

interface EnrichedDataset {
  id: string;
  name: string;
  description: string | null | undefined;
  version: number;
  targetType: string | null | undefined;
  targetIds: string[] | null | undefined;
  updatedAt: string | Date;
  totalExperiments: number;
  completedExperiments: number;
  failedExperiments: number;
  successPct: number | null;
}

interface EvaluationDatasetsTableProps {
  datasets: DatasetRecord[];
  experiments: DatasetExperiment[];
  isLoading: boolean;
  error?: Error | null;
  onCreateClick?: () => void;
}

export function EvaluationDatasetsTable({
  datasets,
  experiments,
  isLoading,
  error,
  onCreateClick,
}: EvaluationDatasetsTableProps) {
  const [search, setSearch] = useState('');
  const { navigate, paths } = useLinkComponent();

  const enrichedDatasets: EnrichedDataset[] = useMemo(() => {
    const expsByDataset = new Map<string, { total: number; completed: number; failed: number }>();
    for (const exp of experiments) {
      const key = exp.datasetId ?? '';
      if (!expsByDataset.has(key)) {
        expsByDataset.set(key, { total: 0, completed: 0, failed: 0 });
      }
      const c = expsByDataset.get(key)!;
      c.total++;
      if (exp.status === 'completed') c.completed++;
      if (exp.status === 'failed') c.failed++;
    }

    return datasets.map(ds => {
      const ec = expsByDataset.get(ds.id) ?? { total: 0, completed: 0, failed: 0 };
      return {
        id: ds.id,
        name: ds.name,
        description: ds.description,
        version: ds.version,
        targetType: ds.targetType,
        targetIds: ds.targetIds,
        updatedAt: ds.updatedAt,
        totalExperiments: ec.total,
        completedExperiments: ec.completed,
        failedExperiments: ec.failed,
        successPct: ec.total > 0 ? Math.round((ec.completed / ec.total) * 100) : null,
      };
    });
  }, [datasets, experiments]);

  if (error && is403ForbiddenError(error)) {
    return (
      <div className="flex h-full items-center justify-center">
        <PermissionDenied resource="datasets" />
      </div>
    );
  }

  if (enrichedDatasets.length === 0 && !isLoading) {
    return <EmptyDatasetsTable onCreateClick={onCreateClick} />;
  }

  const filteredDatasets = enrichedDatasets.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <SearchbarWrapper>
        <Searchbar onSearch={setSearch} label="Search datasets" placeholder="Search datasets" />
      </SearchbarWrapper>

      {isLoading ? (
        <EvaluationDatasetsTableSkeleton />
      ) : (
        <ScrollableContainer>
          <Table>
            <Thead className="sticky top-0">
              <Th>Name</Th>
              <Th style={{ width: 80 }}>Version</Th>
              <Th style={{ width: 120 }}>Target</Th>
              <Th style={{ width: 100 }}>Experiments</Th>
              <Th style={{ width: 100 }}>Success %</Th>
              <Th style={{ width: 150 }}>Last Updated</Th>
            </Thead>
            <Tbody>
              {filteredDatasets.map(ds => (
                <Row key={ds.id} onClick={() => navigate(paths.datasetLink(ds.id))}>
                  <Cell>
                    <EntryCell name={ds.name} description={ds.description || 'No description'} />
                  </Cell>
                  <Cell>v{ds.version}</Cell>
                  <Cell>
                    {ds.targetType ? (
                      <Badge variant="info">{ds.targetType}</Badge>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </Cell>
                  <Cell>
                    <span className="tabular-nums">{ds.totalExperiments}</span>
                  </Cell>
                  <Cell>
                    {ds.successPct != null ? (
                      <Badge variant={ds.successPct >= 70 ? 'success' : ds.successPct >= 40 ? 'warning' : 'error'}>
                        {ds.successPct}%
                      </Badge>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </Cell>
                  <Cell>
                    {ds.updatedAt instanceof Date
                      ? ds.updatedAt.toLocaleDateString()
                      : new Date(ds.updatedAt).toLocaleDateString()}
                  </Cell>
                </Row>
              ))}
            </Tbody>
          </Table>
        </ScrollableContainer>
      )}
    </div>
  );
}

const EvaluationDatasetsTableSkeleton = () => (
  <Table>
    <Thead>
      <Th>Name</Th>
      <Th>Version</Th>
      <Th>Target</Th>
      <Th>Experiments</Th>
      <Th>Success %</Th>
      <Th>Last Updated</Th>
    </Thead>
    <Tbody>
      {Array.from({ length: 3 }).map((_, index) => (
        <Row key={index}>
          {Array.from({ length: 6 }).map((_, ci) => (
            <Cell key={ci}>
              <Skeleton className="h-4 w-20" />
            </Cell>
          ))}
        </Row>
      ))}
    </Tbody>
  </Table>
);
