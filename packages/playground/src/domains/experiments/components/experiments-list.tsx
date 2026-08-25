import type { DatasetExperiment, DatasetRecord } from '@mastra/client-js';
import {
  DataList as EntityList,
  DataListSkeleton as EntityListSkeleton,
  useDataListKeyboard,
} from '@mastra/playground-ui/components/DataList';
import { getShortId } from '@mastra/playground-ui/components/Text';
import { useMemo } from 'react';
import {
  EXPERIMENT_DATASET_COLUMN,
  EXPERIMENT_DETAIL_COLUMNS,
  EXPERIMENT_NAME_COLUMN,
  experimentColumnLabels,
} from './experiment-columns';
import { ExperimentRowCells } from './experiment-row-cells';
import { useLinkComponent } from '@/lib/framework';

export interface ExperimentsListProps {
  experiments: DatasetExperiment[];
  datasets?: DatasetRecord[];
  reviewByExperiment?: Map<string, { needsReview: number; complete: number; total: number }>;
  isLoading: boolean;
  search?: string;
  statusFilter?: string;
  datasetFilter?: string;
}

const COLUMNS = `${EXPERIMENT_NAME_COLUMN} ${EXPERIMENT_DATASET_COLUMN} ${EXPERIMENT_DETAIL_COLUMNS}`;

export function ExperimentsList({
  experiments,
  datasets,
  reviewByExperiment,
  isLoading,
  search = '',
  statusFilter = 'all',
  datasetFilter = 'all',
}: ExperimentsListProps) {
  const { paths, Link } = useLinkComponent();

  const datasetMap = useMemo(() => {
    const map = new Map<string, string>();
    datasets?.forEach(ds => map.set(ds.id, ds.name));
    return map;
  }, [datasets]);

  const sortedExperiments = useMemo(() => {
    return [...experiments].sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return db - da;
    });
  }, [experiments]);

  const filteredData = useMemo(() => {
    const term = search.toLowerCase();
    return sortedExperiments.filter(exp => {
      const dsName = exp.datasetId ? (datasetMap.get(exp.datasetId) ?? '') : '';
      const matchesSearch =
        !term ||
        exp.id.toLowerCase().includes(term) ||
        (exp.name ?? '').toLowerCase().includes(term) ||
        dsName.toLowerCase().includes(term) ||
        (exp.targetId ?? '').toLowerCase().includes(term);
      const matchesStatus = statusFilter === 'all' || exp.status === statusFilter;
      const matchesDataset = datasetFilter === 'all' || exp.datasetId === datasetFilter;
      return matchesSearch && matchesStatus && matchesDataset;
    });
  }, [sortedExperiments, search, datasetMap, statusFilter, datasetFilter]);

  const { containerRef, getRowProps } = useDataListKeyboard({ count: filteredData.length });

  if (isLoading) {
    return <EntityListSkeleton columns={COLUMNS} />;
  }

  return (
    <EntityList columns={COLUMNS} variant="striped" scrollRef={containerRef}>
      <EntityList.Top>
        <EntityList.TopCell>{experimentColumnLabels.experiment}</EntityList.TopCell>
        <EntityList.TopCell>{experimentColumnLabels.dataset}</EntityList.TopCell>
        <EntityList.TopCell>{experimentColumnLabels.target}</EntityList.TopCell>
        <EntityList.TopCell>{experimentColumnLabels.status}</EntityList.TopCell>
        <EntityList.TopCell className="text-center">{experimentColumnLabels.items}</EntityList.TopCell>
        <EntityList.TopCell className="text-center">{experimentColumnLabels.succeeded}</EntityList.TopCell>
        <EntityList.TopCell className="text-center">{experimentColumnLabels.failed}</EntityList.TopCell>
        <EntityList.TopCell className="text-center">{experimentColumnLabels.review}</EntityList.TopCell>
        <EntityList.TopCell>{experimentColumnLabels.date}</EntityList.TopCell>
      </EntityList.Top>

      {filteredData.map((exp, index) => {
        const dsName = exp.datasetId
          ? (datasetMap.get(exp.datasetId) ?? getShortId(exp.datasetId) ?? exp.datasetId)
          : '—';

        return (
          <EntityList.RowLink
            key={exp.id}
            to={paths.experimentLink(exp.id)}
            LinkComponent={Link}
            {...getRowProps(index)}
          >
            <ExperimentRowCells experiment={exp} datasetName={dsName} review={reviewByExperiment?.get(exp.id)} />
          </EntityList.RowLink>
        );
      })}
    </EntityList>
  );
}
