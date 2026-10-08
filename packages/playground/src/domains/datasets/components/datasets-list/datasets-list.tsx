import type { DatasetExperiment, DatasetRecord } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import type { BadgeVariant } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import type { DataListScroll } from '@mastra/playground-ui/components/DataList';
import { DataList, useDataListKeyboard } from '@mastra/playground-ui/components/DataList';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import type { ListSort } from '@mastra/playground-ui/sort/sort-by';
import { formatDate } from '@mastra/playground-ui/utils/date-format';
import { useMemo, useRef } from 'react';
import type { ReactNode, SyntheticEvent } from 'react';
import { DATASETS_LIST_COLUMNS } from './helpers';
import { ComputedTag } from '@/domains/observability/components/computed-tag';

export interface DatasetsListProps {
  scroll?: DataListScroll;
  datasets: DatasetRecord[];
  experiments: Pick<DatasetExperiment, 'datasetId' | 'status'>[];
  search?: string;
  experimentFilter?: string;
  tagFilter?: string;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  setEndOfListElement?: (element: HTMLDivElement | null) => void;
  /**
   * When provided, rows call this instead of navigating to the dataset page
   * and the experiments badge stops being a link.
   */
  onSelectDataset?: (dataset: DatasetRecord) => void;
  /** Highlights the row for this dataset (only meaningful with `onSelectDataset`). */
  selectedDatasetId?: string;
  /** Whether arrow-key roving listens on the document. Defaults to `true`. */
  keyboardGlobal?: boolean;
  /**
   * Overrides the trailing "Experiments" cell for a dataset. Return `null` to
   * fall back to the default experiments badge.
   */
  renderTrailingCell?: (dataset: DatasetRecord) => ReactNode | null;
  /** Server-side sort; headers are only sortable when `onSortChange` is provided. */
  sort?: ListSort<DatasetsSortKey>;
  onSortChange?: (direction: 'asc' | 'desc', key: DatasetsSortKey) => void;
}

export type DatasetsSortKey = 'name' | 'updatedAt';

function getExperimentsBadgeVariant(successPct: number | null): BadgeVariant {
  if (successPct !== null && successPct >= 70) return 'success';
  if (successPct !== null && successPct >= 40) return 'warning';
  return 'destructive';
}

const stopPropagation = (event: SyntheticEvent) => event.stopPropagation();

type EnrichedDataset = DatasetRecord & { experimentCount: number; successPct: number | null };

type RowProps = ReturnType<ReturnType<typeof useDataListKeyboard>['getRowProps']>;

function TagsCell({ tags: rawTags }: { tags: DatasetRecord['tags'] }) {
  const tags = Array.isArray(rawTags) ? rawTags.filter(tag => typeof tag === 'string') : [];

  return (
    <DataList.Cell>
      {tags.length > 0 ? (
        <div className="flex max-w-48 items-center gap-1 overflow-hidden" title={tags.join(', ')}>
          {tags.slice(0, 2).map(tag => (
            <ComputedTag key={tag} value={tag} className="shrink-0" />
          ))}
          {tags.length > 2 && (
            <Txt as="span" variant="meta" tone="faint" className="shrink-0">
              +{tags.length - 2}
            </Txt>
          )}
        </div>
      ) : (
        <span className="text-placeholder">—</span>
      )}
    </DataList.Cell>
  );
}

function ExperimentsBadge({ dataset: ds }: { dataset: EnrichedDataset }) {
  return (
    <Badge variant={getExperimentsBadgeVariant(ds.successPct)} size="sm">
      {ds.experimentCount} ({ds.successPct ?? 0}%)
    </Badge>
  );
}

/**
 * Selectable row: the whole row is a button that reports the dataset to the
 * parent (e.g. to open a side panel) instead of navigating.
 */
function SelectableDatasetRow({
  dataset: ds,
  rowProps,
  featured,
  onSelect,
  trailingCell,
}: {
  dataset: EnrichedDataset;
  rowProps: RowProps;
  featured: boolean;
  onSelect: (dataset: DatasetRecord) => void;
  trailingCell: ReactNode | null;
}) {
  return (
    <DataList.RowButton {...rowProps} featured={featured} onClick={() => onSelect(ds)}>
      <DataList.NameCell>{ds.name}</DataList.NameCell>
      <DataList.DescriptionCell>{ds.description}</DataList.DescriptionCell>
      <TagsCell tags={ds.tags} />
      <DataList.TextCell>v{ds.version ?? 1}</DataList.TextCell>
      <DataList.TextCell>{formatDate(ds.updatedAt, 'date-time') ?? '—'}</DataList.TextCell>
      <DataList.Cell>
        {trailingCell ??
          (ds.experimentCount > 0 ? <ExperimentsBadge dataset={ds} /> : <span className="text-placeholder">—</span>)}
      </DataList.Cell>
    </DataList.RowButton>
  );
}

/**
 * Wrapper owns focus/roving and activation so the whole row navigates; the
 * link and the trailing experiments button stop propagation to avoid double
 * activation.
 */
function DatasetRow({
  dataset: ds,
  rowProps,
  trailingCell,
}: {
  dataset: EnrichedDataset;
  rowProps: RowProps;
  trailingCell: ReactNode | null;
}) {
  const { paths, Link } = useLinkComponent();
  const linkRef = useRef<HTMLAnchorElement>(null);
  const hasExperimentsAction = trailingCell === null && ds.experimentCount > 0;
  const hasTrailingCell = hasExperimentsAction || trailingCell !== null;

  return (
    <DataList.RowWrapper {...rowProps} onSelectRow={() => linkRef.current?.click()}>
      <DataList.RowLink
        ref={linkRef}
        colEnd={hasTrailingCell ? -2 : -1}
        to={paths.datasetLink(ds.id)}
        LinkComponent={Link}
        tabIndex={-1}
        onClick={stopPropagation}
      >
        <DataList.NameCell>{ds.name}</DataList.NameCell>
        <DataList.DescriptionCell>{ds.description}</DataList.DescriptionCell>
        <TagsCell tags={ds.tags} />
        <DataList.TextCell>v{ds.version ?? 1}</DataList.TextCell>
        <DataList.TextCell>{formatDate(ds.updatedAt, 'date-time') ?? '—'}</DataList.TextCell>
        {hasTrailingCell ? null : <DataList.Cell className="justify-center" />}
      </DataList.RowLink>

      {trailingCell !== null && <DataList.Cell>{trailingCell}</DataList.Cell>}
      {hasExperimentsAction && (
        <Button
          render={<Link href={`/experiments?dataset=${ds.id}`} />}

          variant="ghost"
          size="sm"
          className="h-full w-full rounded-lg p-0!"
          onClick={stopPropagation}
        >
          <ExperimentsBadge dataset={ds} />
        </Button>
      )}
    </DataList.RowWrapper>
  );
}

export function DatasetsList({
  scroll,
  datasets,
  experiments,
  search = '',
  experimentFilter = 'all',
  tagFilter = 'all',
  isFetchingNextPage,
  hasNextPage,
  setEndOfListElement,
  onSelectDataset,
  selectedDatasetId,
  keyboardGlobal = true,
  renderTrailingCell,
  sort,
  onSortChange,
}: DatasetsListProps) {
  const enrichedDatasets = useMemo(() => {
    return datasets.map(ds => {
      const dsExperiments = experiments.filter(e => e.datasetId === ds.id);
      const completed = dsExperiments.filter(e => e.status === 'completed').length;
      const total = dsExperiments.length;
      const successPct = total > 0 ? Math.round((completed / total) * 100) : null;
      return { ...ds, experimentCount: total, successPct };
    });
  }, [datasets, experiments]);

  const filteredData = useMemo(() => {
    const term = search.toLowerCase();
    return enrichedDatasets.filter(ds => {
      const matchesSearch = !term || ds.name.toLowerCase().includes(term);
      const matchesExperiment =
        experimentFilter === 'all' ||
        (experimentFilter === 'with' && ds.experimentCount > 0) ||
        (experimentFilter === 'without' && ds.experimentCount === 0);
      const matchesTag = tagFilter === 'all' || (Array.isArray(ds.tags) && ds.tags.includes(tagFilter));
      return matchesSearch && matchesExperiment && matchesTag;
    });
  }, [enrichedDatasets, search, experimentFilter, tagFilter]);

  const { containerRef, getRowProps } = useDataListKeyboard({ count: filteredData.length, global: keyboardGlobal });

  return (
    <DataList scroll={scroll} columns={DATASETS_LIST_COLUMNS} scrollRef={containerRef}>
      <DataList.Top>
        {onSortChange ? (
          <DataList.SortableTopCell
            sortKey="name"
            sort={sort?.key === 'name' ? sort.direction : undefined}
            onSortChange={onSortChange}
          >
            Name
          </DataList.SortableTopCell>
        ) : (
          <DataList.TopCell>Name</DataList.TopCell>
        )}
        <DataList.TopCell>Description</DataList.TopCell>
        <DataList.TopCell>Tags</DataList.TopCell>
        <DataList.TopCell>Version</DataList.TopCell>
        {onSortChange ? (
          <DataList.SortableTopCell
            sortKey="updatedAt"
            sort={sort?.key === 'updatedAt' ? sort.direction : undefined}
            onSortChange={onSortChange}
          >
            Last Updated
          </DataList.SortableTopCell>
        ) : (
          <DataList.TopCell>Last Updated</DataList.TopCell>
        )}
        <DataList.TopCell>Experiments</DataList.TopCell>
      </DataList.Top>

      {filteredData.map((ds, index) =>
        onSelectDataset ? (
          <SelectableDatasetRow
            key={ds.id}
            dataset={ds}
            rowProps={getRowProps(index)}
            featured={ds.id === selectedDatasetId}
            onSelect={onSelectDataset}
            trailingCell={renderTrailingCell?.(ds) ?? null}
          />
        ) : (
          <DatasetRow
            key={ds.id}
            dataset={ds}
            rowProps={getRowProps(index)}
            trailingCell={renderTrailingCell?.(ds) ?? null}
          />
        ),
      )}

      <DataList.NextPageLoading
        isLoading={isFetchingNextPage}
        hasMore={hasNextPage}
        setEndOfListElement={setEndOfListElement}
      />
    </DataList>
  );
}
