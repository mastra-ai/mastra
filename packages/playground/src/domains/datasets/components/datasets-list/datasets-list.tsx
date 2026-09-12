import type { DatasetExperiment, DatasetRecord } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import type { BadgeVariant } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import {
  DataList as EntityList,
  DataListSkeleton as EntityListSkeleton,
  useDataListKeyboard,
} from '@mastra/playground-ui/components/DataList';
import { useMemo, useRef } from 'react';
import type { SyntheticEvent } from 'react';
import { ComputedTag } from '@/domains/observability/components/computed-tag';
import { useLinkComponent } from '@/lib/framework';

export interface DatasetsListProps {
  datasets: DatasetRecord[];
  experiments: DatasetExperiment[];
  isLoading: boolean;
  search?: string;
  experimentFilter?: string;
  tagFilter?: string;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  setEndOfListElement?: (element: HTMLDivElement | null) => void;
}

const COLUMNS = 'auto 1fr auto 5rem 10rem 7rem';

function getExperimentsBadgeVariant(successPct: number | null): BadgeVariant {
  if (successPct !== null && successPct >= 70) return 'green';
  if (successPct !== null && successPct >= 40) return 'yellow';
  return 'red';
}

function formatDate(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return '—';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const stopPropagation = (event: SyntheticEvent) => event.stopPropagation();

type EnrichedDataset = DatasetRecord & { experimentCount: number; successPct: number | null };

/**
 * Wrapper owns focus/roving and activation so the whole row navigates; the
 * link and the trailing experiments button stop propagation to avoid double
 * activation.
 */
function DatasetRow({
  dataset: ds,
  rowProps,
}: {
  dataset: EnrichedDataset;
  rowProps: ReturnType<ReturnType<typeof useDataListKeyboard>['getRowProps']>;
}) {
  const { paths, Link } = useLinkComponent();
  const linkRef = useRef<HTMLAnchorElement>(null);
  const experimentsBadgeVariant = getExperimentsBadgeVariant(ds.successPct);
  const tags = Array.isArray(ds.tags) ? ds.tags.filter(tag => typeof tag === 'string') : [];
  const hasExperimentsAction = ds.experimentCount > 0;

  return (
    <EntityList.RowWrapper {...rowProps} onSelectRow={() => linkRef.current?.click()}>
      <EntityList.RowLink
        ref={linkRef}
        colEnd={hasExperimentsAction ? -2 : -1}
        to={paths.datasetLink(ds.id)}
        LinkComponent={Link}
        tabIndex={-1}
        onClick={stopPropagation}
      >
        <EntityList.NameCell>{ds.name}</EntityList.NameCell>
        <EntityList.DescriptionCell>{ds.description}</EntityList.DescriptionCell>
        <EntityList.Cell>
          {tags.length > 0 ? (
            <div className="flex max-w-48 items-center gap-1 overflow-hidden" title={tags.join(', ')}>
              {tags.slice(0, 2).map(tag => (
                <ComputedTag key={tag} value={tag} className="shrink-0" />
              ))}
              {tags.length > 2 && <span className="text-neutral2 text-ui-xs shrink-0">+{tags.length - 2}</span>}
            </div>
          ) : (
            <span className="text-neutral2">—</span>
          )}
        </EntityList.Cell>
        <EntityList.TextCell>v{ds.version ?? 1}</EntityList.TextCell>
        <EntityList.TextCell>{formatDate(ds.updatedAt)}</EntityList.TextCell>
        {hasExperimentsAction ? null : <EntityList.Cell className="justify-center" />}
      </EntityList.RowLink>

      {hasExperimentsAction ? (
        <Button
          as={Link}
          to={`/experiments?dataset=${ds.id}`}
          variant="ghost"
          size="sm"
          className="h-full w-full rounded-lg p-0!"
          onClick={stopPropagation}
        >
          <Badge variant={experimentsBadgeVariant} size="sm">
            {ds.experimentCount} ({ds.successPct ?? 0}%)
          </Badge>
        </Button>
      ) : null}
    </EntityList.RowWrapper>
  );
}

export function DatasetsList({
  datasets,
  experiments,
  isLoading,
  search = '',
  experimentFilter = 'all',
  tagFilter = 'all',
  isFetchingNextPage,
  hasNextPage,
  setEndOfListElement,
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
      const matchesTag = tagFilter === 'all' || (Array.isArray(ds.tags) && (ds.tags as string[]).includes(tagFilter));
      return matchesSearch && matchesExperiment && matchesTag;
    });
  }, [enrichedDatasets, search, experimentFilter, tagFilter]);

  const { containerRef, getRowProps } = useDataListKeyboard({ count: filteredData.length, global: true });

  if (isLoading) {
    return <EntityListSkeleton columns={COLUMNS} />;
  }

  return (
    <EntityList columns={COLUMNS} scrollRef={containerRef}>
      <EntityList.Top>
        <EntityList.TopCell>Name</EntityList.TopCell>
        <EntityList.TopCell>Description</EntityList.TopCell>
        <EntityList.TopCell>Tags</EntityList.TopCell>
        <EntityList.TopCell>Version</EntityList.TopCell>
        <EntityList.TopCell>Last Updated</EntityList.TopCell>
        <EntityList.TopCell>Experiments</EntityList.TopCell>
      </EntityList.Top>

      {filteredData.map((ds, index) => (
        <DatasetRow key={ds.id} dataset={ds} rowProps={getRowProps(index)} />
      ))}

      <EntityList.NextPageLoading
        isLoading={isFetchingNextPage}
        hasMore={hasNextPage}
        setEndOfListElement={setEndOfListElement}
      />
    </EntityList>
  );
}
