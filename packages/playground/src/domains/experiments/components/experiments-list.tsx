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
  /** When provided, rows toggle selection (for comparison) instead of navigating. */
  selection?: ExperimentsListSelection;
}

export interface ExperimentsListSelection {
  selectedExperimentIds: string[];
  onToggleSelection: (experimentId: string) => void;
}

const COLUMNS = `${EXPERIMENT_NAME_COLUMN} ${EXPERIMENT_DATASET_COLUMN} ${EXPERIMENT_DETAIL_COLUMNS}`;

const columnHeaders = [
  { label: experimentColumnLabels.experiment },
  { label: experimentColumnLabels.dataset },
  { label: experimentColumnLabels.target },
  { label: experimentColumnLabels.status },
  { label: experimentColumnLabels.items, className: 'text-center' },
  { label: experimentColumnLabels.succeeded, className: 'text-center' },
  { label: experimentColumnLabels.failed, className: 'text-center' },
  { label: experimentColumnLabels.review, className: 'text-center' },
  { label: experimentColumnLabels.date },
];

export function ExperimentsList({
  experiments,
  datasets,
  reviewByExperiment,
  isLoading,
  search = '',
  statusFilter = 'all',
  datasetFilter = 'all',
  selection,
}: ExperimentsListProps) {
  const isSelectionActive = selection !== undefined;
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

  const gridColumns = isSelectionActive ? `auto ${COLUMNS}` : COLUMNS;
  const headerCells = columnHeaders.map(col => (
    <EntityList.TopCell key={col.label} className={col.className}>
      {col.label}
    </EntityList.TopCell>
  ));

  return (
    <EntityList columns={gridColumns} variant="striped" scrollRef={containerRef}>
      <EntityList.Top hasLeadingCell={isSelectionActive}>
        {isSelectionActive ? (
          <>
            <EntityList.TopCell>&nbsp;</EntityList.TopCell>
            <EntityList.TopCells colStart={2}>{headerCells}</EntityList.TopCells>
          </>
        ) : (
          headerCells
        )}
      </EntityList.Top>

      {filteredData.map((exp, index) => {
        const dsName = exp.datasetId
          ? (datasetMap.get(exp.datasetId) ?? getShortId(exp.datasetId) ?? exp.datasetId)
          : '—';
        const rowCells = (
          <ExperimentRowCells experiment={exp} datasetName={dsName} review={reviewByExperiment?.get(exp.id)} />
        );

        if (!selection) {
          return (
            <EntityList.RowLink
              key={exp.id}
              to={paths.experimentLink(exp.id)}
              LinkComponent={Link}
              {...getRowProps(index)}
            >
              {rowCells}
            </EntityList.RowLink>
          );
        }

        const isSelected = selection.selectedExperimentIds.includes(exp.id);
        const toggle = () => selection.onToggleSelection(exp.id);

        return (
          <EntityList.RowWrapper key={exp.id}>
            <EntityList.SelectCell checked={isSelected} onToggle={toggle} aria-label={`Select experiment ${exp.id}`} />
            <EntityList.RowButton colStart={2} featured={isSelected} onClick={toggle} {...getRowProps(index)}>
              {rowCells}
            </EntityList.RowButton>
          </EntityList.RowWrapper>
        );
      })}
    </EntityList>
  );
}
