import type { DatasetExperiment, DatasetRecord } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { DataList, DataListSkeleton, useDataListKeyboard } from '@mastra/playground-ui/components/DataList';
import { getShortId } from '@mastra/playground-ui/components/Text';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import type { ListSort } from '@mastra/playground-ui/sort/sort-by';
import type { ExperimentListMetrics } from '@mastra/react/hooks/experiments';
import { Trash2 } from 'lucide-react';
import type { MouseEvent, ReactNode, SyntheticEvent } from 'react';
import { useMemo, useRef, useState } from 'react';
import { columnLabel, sideVariant } from './comparison/constants';
import { DeleteExperimentDialog } from './delete-experiment-dialog';
import {
  EXPERIMENT_DATASET_COLUMN,
  EXPERIMENT_DESCRIPTION_COLUMN,
  EXPERIMENT_DETAIL_COLUMNS,
  EXPERIMENT_NAME_COLUMN,
  EXPERIMENT_USAGE_COLUMNS,
  experimentColumnLabels,
} from './experiment-columns';
import { ExperimentRowCells } from './experiment-row-cells';

export interface ExperimentsListProps {
  experiments: DatasetExperiment[];
  datasets?: DatasetRecord[];
  reviewByExperiment?: Map<string, { needsReview: number; complete: number; total: number }>;
  /**
   * Token usage, cost and average duration keyed by experiment id. When provided, the list shows
   * the avg duration, tokens and cost columns; leave it off when the store cannot serve metrics.
   */
  metricsByExperiment?: Map<string, ExperimentListMetrics>;
  isLoading: boolean;
  search?: string;
  statusFilter?: string;
  datasetFilter?: string;
  /** When provided, rows get a leading checkbox (for comparison) and the header a select-all checkbox. */
  selection?: ExperimentsListSelection;
  /** When provided, rows call this instead of navigating (e.g. to open a side panel). */
  onSelectExperiment?: (experiment: DatasetExperiment) => void;
  /** Highlights the row matching this id when `onSelectExperiment` is used. */
  selectedExperimentId?: string;
  /** Whether keyboard roving is bound globally. Defaults to true. */
  keyboardGlobal?: boolean;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  setEndOfListElement?: (element: HTMLDivElement | null) => void;
  /**
   * Server-side sort. When provided the list keeps the server order instead of
   * re-sorting by `createdAt` client-side; headers are sortable when `onSortChange` is set.
   */
  sort?: ListSort<ExperimentsSortKey>;
  onSortChange?: (direction: 'asc' | 'desc', key: ExperimentsSortKey) => void;
}

export type ExperimentsSortKey = 'createdAt' | 'status';

export interface ExperimentsListSelection {
  selectedExperimentIds: string[];
  onToggleSelection: (experimentId: string) => void;
  /** Receives the ids currently listed (after filtering), in display order. */
  onToggleAll: (visibleExperimentIds: string[]) => void;
  /** Only experiments of this dataset can join the selection; the others get a disabled checkbox. */
  comparableDatasetId?: string;
}

const BASE_COLUMNS = `${EXPERIMENT_NAME_COLUMN} ${EXPERIMENT_DESCRIPTION_COLUMN} ${EXPERIMENT_DATASET_COLUMN} ${EXPERIMENT_DETAIL_COLUMNS}`;

// Trailing `auto` track hosts the row actions cell (delete), which only navigating rows render.
const COLUMNS = `${BASE_COLUMNS} auto`;
const COLUMNS_WITH_USAGE = `${BASE_COLUMNS} ${EXPERIMENT_USAGE_COLUMNS} auto`;

type ColumnHeader = { label: string; className?: string; sortKey?: ExperimentsSortKey };

const usageColumnHeaders: ColumnHeader[] = [
  { label: experimentColumnLabels.avgDuration, className: 'text-center' },
  { label: experimentColumnLabels.tokens, className: 'text-center' },
  { label: experimentColumnLabels.cost, className: 'text-center' },
];

const getColumnHeaders = (showUsage: boolean): ColumnHeader[] => [
  { label: experimentColumnLabels.experiment },
  { label: experimentColumnLabels.description },
  { label: experimentColumnLabels.dataset },
  { label: experimentColumnLabels.target },
  { label: experimentColumnLabels.status, sortKey: 'status' },
  { label: experimentColumnLabels.items, className: 'text-center' },
  { label: experimentColumnLabels.succeeded, className: 'text-center' },
  { label: experimentColumnLabels.failed, className: 'text-center' },
  { label: experimentColumnLabels.duration, className: 'text-center' },
  ...(showUsage ? usageColumnHeaders : []),
  { label: experimentColumnLabels.review, className: 'text-center' },
  { label: experimentColumnLabels.date, sortKey: 'createdAt' },
];

const stopPropagation = (event: SyntheticEvent) => event.stopPropagation();

/**
 * Wrapper owns focus/roving and activation so the whole row activates; the
 * link/button and the delete button stop propagation to avoid double activation.
 */
function ExperimentRow({
  experiment: exp,
  rowProps,
  onSelect,
  featured,
  onDelete,
  leadingCell,
  children,
}: {
  experiment: DatasetExperiment;
  rowProps: ReturnType<ReturnType<typeof useDataListKeyboard>['getRowProps']>;
  onSelect?: () => void;
  featured?: boolean;
  onDelete: () => void;
  /** Rendered in the first column (e.g. a selection checkbox); shifts the row content one column right. */
  leadingCell?: ReactNode;
  children: ReactNode;
}) {
  const colStart = leadingCell ? 2 : undefined;
  const { paths, Link } = useLinkComponent();
  const linkRef = useRef<HTMLAnchorElement>(null);

  return (
    <DataList.RowWrapper {...rowProps} onSelectRow={onSelect ?? (() => linkRef.current?.click())}>
      {leadingCell}
      {onSelect ? (
        <DataList.RowButton
          colStart={colStart}
          colEnd={-2}
          featured={featured}
          tabIndex={-1}
          onClick={(e: MouseEvent) => {
            e.stopPropagation();
            onSelect();
          }}
        >
          {children}
        </DataList.RowButton>
      ) : (
        <DataList.RowLink
          ref={linkRef}
          colStart={colStart}
          colEnd={-2}
          featured={featured}
          to={paths.experimentLink(exp.id)}
          LinkComponent={Link}
          tabIndex={-1}
          onClick={stopPropagation}
        >
          {children}
        </DataList.RowLink>
      )}
      <DataList.ActionsCell className="pl-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          tooltip="Delete experiment"
          aria-label={`Delete experiment ${exp.name ?? exp.id}`}
          onClick={(e: MouseEvent) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="size-4" />
        </Button>
      </DataList.ActionsCell>
    </DataList.RowWrapper>
  );
}

export function ExperimentsList({
  experiments,
  datasets,
  reviewByExperiment,
  metricsByExperiment,
  isLoading,
  search = '',
  statusFilter = 'all',
  datasetFilter = 'all',
  selection,
  onSelectExperiment,
  selectedExperimentId,
  keyboardGlobal = true,
  isFetchingNextPage,
  hasNextPage,
  setEndOfListElement,
  sort,
  onSortChange,
}: ExperimentsListProps) {
  const datasetMap = useMemo(() => {
    const map = new Map<string, string>();
    datasets?.forEach(ds => map.set(ds.id, ds.name));
    return map;
  }, [datasets]);

  const sortedExperiments = useMemo(() => {
    if (sort) return experiments;
    return [...experiments].sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return db - da;
    });
  }, [experiments, sort]);

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

  const { containerRef, getRowProps } = useDataListKeyboard({ count: filteredData.length, global: keyboardGlobal });

  const [experimentToDelete, setExperimentToDelete] = useState<DatasetExperiment | null>(null);

  const showUsage = metricsByExperiment !== undefined;
  const columns = showUsage ? COLUMNS_WITH_USAGE : COLUMNS;

  if (isLoading) {
    return <DataListSkeleton columns={columns} />;
  }

  const selectedCount = selection?.selectedExperimentIds.length ?? 0;
  const selectAllState =
    selectedCount === 0 || filteredData.length === 0
      ? false
      : filteredData.every(exp => selection?.selectedExperimentIds.includes(exp.id))
        ? true
        : ('indeterminate' as const);
  const gridColumns = selection ? `auto ${columns}` : columns;
  const headerCells = getColumnHeaders(showUsage).map(col =>
    col.sortKey && onSortChange ? (
      <DataList.SortableTopCell
        key={col.label}
        className={col.className}
        sortKey={col.sortKey}
        sort={sort?.key === col.sortKey ? sort.direction : undefined}
        onSortChange={onSortChange}
      >
        {col.label}
      </DataList.SortableTopCell>
    ) : (
      <DataList.TopCell key={col.label} className={col.className}>
        {col.label}
      </DataList.TopCell>
    ),
  );

  return (
    <DataList columns={gridColumns} scrollRef={containerRef}>
      <DataList.Top hasLeadingCell={selection !== undefined}>
        {selection ? (
          <>
            <DataList.TopSelectCell
              checked={selectAllState}
              onToggle={() => selection.onToggleAll(filteredData.map(exp => exp.id))}
              aria-label="Select all experiments"
            />
            <DataList.TopCells colStart={2}>
              {headerCells}
              <DataList.TopCell aria-hidden>{null}</DataList.TopCell>
            </DataList.TopCells>
          </>
        ) : (
          <>
            {headerCells}
            <DataList.TopCell aria-hidden>{null}</DataList.TopCell>
          </>
        )}
      </DataList.Top>

      {filteredData.length === 0 && !hasNextPage ? (
        <DataList.NoMatch message="No experiments match your filters" />
      ) : null}

      {filteredData.map((exp, index) => {
        const dsName = exp.datasetId
          ? (datasetMap.get(exp.datasetId) ?? getShortId(exp.datasetId) ?? exp.datasetId)
          : '—';
        const selectionIndex = selection?.selectedExperimentIds.indexOf(exp.id) ?? -1;
        const isSelected = selectionIndex !== -1;
        const isDisabled =
          !isSelected &&
          selection?.comparableDatasetId !== undefined &&
          exp.datasetId !== selection.comparableDatasetId;
        const rowCells = (
          <ExperimentRowCells
            experiment={exp}
            datasetName={dsName}
            review={reviewByExperiment?.get(exp.id)}
            showUsage={showUsage}
            metrics={metricsByExperiment?.get(exp.id)}
            selectionRole={
              isSelected
                ? {
                    label: columnLabel(selectionIndex),
                    variant: selectionIndex === 0 ? sideVariant.baseline : sideVariant.contender,
                  }
                : undefined
            }
          />
        );

        return (
          <ExperimentRow
            key={exp.id}
            experiment={exp}
            rowProps={getRowProps(index)}
            onSelect={onSelectExperiment ? () => onSelectExperiment(exp) : undefined}
            featured={isSelected || selectedExperimentId === exp.id}
            onDelete={() => setExperimentToDelete(exp)}
            leadingCell={
              selection && (
                <DataList.SelectCell
                  checked={isSelected}
                  disabled={isDisabled}
                  onToggle={() => selection.onToggleSelection(exp.id)}
                  aria-label={`Select experiment ${exp.id}`}
                />
              )
            }
          >
            {rowCells}
          </ExperimentRow>
        );
      })}

      <DataList.NextPageLoading
        isLoading={isFetchingNextPage}
        hasMore={hasNextPage}
        setEndOfListElement={setEndOfListElement}
      />

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
    </DataList>
  );
}
