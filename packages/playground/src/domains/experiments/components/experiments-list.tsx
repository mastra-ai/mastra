import type { DatasetExperiment, DatasetRecord } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import {
  DataList as EntityList,
  DataListSkeleton as EntityListSkeleton,
  useDataListKeyboard,
} from '@mastra/playground-ui/components/DataList';
import { getShortId } from '@mastra/playground-ui/components/Text';
import { Trash2 } from 'lucide-react';
import type { MouseEvent } from 'react';
import { useMemo, useState } from 'react';
import { DeleteExperimentDialog } from './delete-experiment-dialog';
import {
  EXPERIMENT_DATASET_COLUMN,
  EXPERIMENT_DESCRIPTION_COLUMN,
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

const BASE_COLUMNS = `${EXPERIMENT_NAME_COLUMN} ${EXPERIMENT_DESCRIPTION_COLUMN} ${EXPERIMENT_DATASET_COLUMN} ${EXPERIMENT_DETAIL_COLUMNS}`;

// Trailing `auto` track hosts the row actions cell (delete), which only navigating rows render.
const COLUMNS = `${BASE_COLUMNS} auto`;

const columnHeaders = [
  { label: experimentColumnLabels.experiment },
  { label: experimentColumnLabels.description },
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

  const [experimentToDelete, setExperimentToDelete] = useState<DatasetExperiment | null>(null);

  if (isLoading) {
    return <EntityListSkeleton columns={COLUMNS} />;
  }

  const gridColumns = isSelectionActive ? `auto ${BASE_COLUMNS}` : COLUMNS;
  const headerCells = columnHeaders.map(col => (
    <EntityList.TopCell key={col.label} className={col.className}>
      {col.label}
    </EntityList.TopCell>
  ));

  return (
    <EntityList columns={gridColumns} scrollRef={containerRef}>
      <EntityList.Top hasLeadingCell={isSelectionActive}>
        {isSelectionActive ? (
          <>
            <EntityList.TopCell>&nbsp;</EntityList.TopCell>
            <EntityList.TopCells colStart={2}>{headerCells}</EntityList.TopCells>
          </>
        ) : (
          <>
            {headerCells}
            <EntityList.TopCell aria-hidden>{null}</EntityList.TopCell>
          </>
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
            <EntityList.RowWrapper key={exp.id}>
              <EntityList.RowLink
                colEnd={-2}
                to={paths.experimentLink(exp.id)}
                LinkComponent={Link}
                {...getRowProps(index)}
              >
                {rowCells}
              </EntityList.RowLink>
              <EntityList.ActionsCell className="pl-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  tooltip="Delete experiment"
                  aria-label={`Delete experiment ${exp.name ?? exp.id}`}
                  onClick={(e: MouseEvent) => {
                    e.stopPropagation();
                    setExperimentToDelete(exp);
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </EntityList.ActionsCell>
            </EntityList.RowWrapper>
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

      {experimentToDelete && (
        <DeleteExperimentDialog
          open
          onOpenChange={open => {
            if (!open) setExperimentToDelete(null);
          }}
          experimentId={experimentToDelete.id}
          experimentName={experimentToDelete.name ?? undefined}
        />
      )}
    </EntityList>
  );
}
