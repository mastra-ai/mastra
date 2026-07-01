import type { DatasetExperiment, DatasetRecord } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { Chip } from '@mastra/playground-ui/components/Chip';
import {
  DataList as EntityList,
  DataListSkeleton as EntityListSkeleton,
} from '@mastra/playground-ui/components/DataList';
import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { ProcessorIcon } from '@mastra/playground-ui/icons/ProcessorIcon';
import { ScorersIcon } from '@mastra/playground-ui/icons/ScorersIcon';
import { WorkflowIcon } from '@mastra/playground-ui/icons/WorkflowIcon';
import { useMemo } from 'react';
import type { DatasetTargetType } from '../target-type-options';
import { getDatasetTargetTypes, matchesDatasetTargetFilter } from './helpers';
import { useLinkComponent } from '@/lib/framework';

export interface DatasetsListProps {
  datasets: DatasetRecord[];
  experiments: DatasetExperiment[];
  reviewByDataset?: Map<string, { needsReview: number; complete: number }>;
  isLoading: boolean;
  search?: string;
  targetFilter?: string;
  experimentFilter?: string;
  tagFilter?: string;
  currentPage?: number;
  hasMore?: boolean;
  onNextPage?: () => void;
  onPrevPage?: () => void;
}

const COLUMNS = 'auto 1fr auto 5rem 9rem 10rem 7rem 8rem';

function getDatasetRowLayout(hasExperimentsAction: boolean, hasReviewAction: boolean) {
  return {
    rowLinkColEnd: hasExperimentsAction ? -3 : hasReviewAction ? -2 : -1,
    showExperimentsPlaceholder: !hasExperimentsAction,
    showReviewPlaceholderInLink: !hasExperimentsAction && !hasReviewAction,
    showReviewPlaceholderAfterExperiments: hasExperimentsAction && !hasReviewAction,
  };
}

function TargetTypeIcon({ type }: { type: DatasetTargetType }) {
  const className = 'size-3.5 shrink-0 text-neutral2';
  switch (type) {
    case 'agent':
      return <AgentIcon className={className} aria-hidden />;
    case 'workflow':
      return <WorkflowIcon className={className} aria-hidden />;
    case 'scorer':
      return <ScorersIcon className={className} aria-hidden />;
    case 'processor':
      return <ProcessorIcon className={className} aria-hidden />;
    default:
      return null;
  }
}

function formatDate(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return '—';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function DatasetsList({
  datasets,
  experiments,
  reviewByDataset,
  isLoading,
  search = '',
  targetFilter = 'all',
  experimentFilter = 'all',
  tagFilter = 'all',
  currentPage,
  hasMore,
  onNextPage,
  onPrevPage,
}: DatasetsListProps) {
  const { paths, Link } = useLinkComponent();

  const enrichedDatasets = useMemo(() => {
    return datasets.map(ds => {
      const dsExperiments = experiments.filter(e => e.datasetId === ds.id);
      const completed = dsExperiments.filter(e => e.status === 'completed').length;
      const total = dsExperiments.length;
      const successPct = total > 0 ? Math.round((completed / total) * 100) : null;
      const targetTypes = getDatasetTargetTypes(ds.targetType, dsExperiments);
      return { ...ds, experimentCount: total, successPct, targetTypes };
    });
  }, [datasets, experiments]);

  const filteredData = useMemo(() => {
    const term = search.toLowerCase();
    return enrichedDatasets.filter(ds => {
      const matchesSearch = !term || ds.name.toLowerCase().includes(term);
      const matchesTarget = matchesDatasetTargetFilter(ds.targetTypes, targetFilter);
      const matchesExperiment =
        experimentFilter === 'all' ||
        (experimentFilter === 'with' && ds.experimentCount > 0) ||
        (experimentFilter === 'without' && ds.experimentCount === 0);
      const matchesTag = tagFilter === 'all' || (Array.isArray(ds.tags) && (ds.tags as string[]).includes(tagFilter));
      return matchesSearch && matchesTarget && matchesExperiment && matchesTag;
    });
  }, [enrichedDatasets, search, targetFilter, experimentFilter, tagFilter]);

  if (isLoading) {
    return <EntityListSkeleton columns={COLUMNS} />;
  }

  return (
    <EntityList columns={COLUMNS} variant="striped">
      <EntityList.Top>
        <EntityList.TopCell>Name</EntityList.TopCell>
        <EntityList.TopCell>Description</EntityList.TopCell>
        <EntityList.TopCell>Tags</EntityList.TopCell>
        <EntityList.TopCell>Version</EntityList.TopCell>
        <EntityList.TopCell>Target</EntityList.TopCell>
        <EntityList.TopCell>Last Updated</EntityList.TopCell>
        <EntityList.TopCell>Experiments</EntityList.TopCell>
        <EntityList.TopCell className="justify-center">Review</EntityList.TopCell>
      </EntityList.Top>

      {filteredData.map(ds => {
        const experimentsChipColor: 'green' | 'yellow' | 'red' =
          ds.successPct !== null && ds.successPct >= 70
            ? 'green'
            : ds.successPct !== null && ds.successPct >= 40
              ? 'yellow'
              : 'red';

        const review = reviewByDataset?.get(ds.id);
        const tags = Array.isArray(ds.tags) ? (ds.tags as string[]) : [];
        const hasExperimentsAction = ds.experimentCount > 0;
        const rowLayout = getDatasetRowLayout(hasExperimentsAction, Boolean(review));

        return (
          <EntityList.RowWrapper key={ds.id}>
            <EntityList.RowLink
              flushRight
              colEnd={rowLayout.rowLinkColEnd}
              to={paths.datasetLink(ds.id)}
              LinkComponent={Link}
            >
              <EntityList.NameCell>{ds.name}</EntityList.NameCell>
              <EntityList.DescriptionCell>{ds.description}</EntityList.DescriptionCell>
              <EntityList.Cell>
                {tags.length > 0 ? (
                  <div className="flex max-w-48 items-center gap-1 overflow-hidden" title={tags.join(', ')}>
                    {tags.slice(0, 2).map(tag => (
                      <Chip key={tag} color="gray" size="small" className="shrink-0">
                        {tag}
                      </Chip>
                    ))}
                    {tags.length > 2 && <span className="shrink-0 text-[10px] text-neutral2">+{tags.length - 2}</span>}
                  </div>
                ) : (
                  <span className="text-neutral2">—</span>
                )}
              </EntityList.Cell>
              <EntityList.TextCell>v{ds.version ?? 1}</EntityList.TextCell>
              <EntityList.Cell className="text-neutral4 text-ui-smd">
                {ds.targetTypes.length > 0 ? (
                  <span className="flex min-w-0 items-center gap-2 overflow-hidden">
                    {ds.targetTypes.map(type => (
                      <span key={type} className="flex min-w-0 items-center gap-1 capitalize">
                        <TargetTypeIcon type={type} />
                        <span className="truncate">{type}</span>
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="text-neutral2">—</span>
                )}
              </EntityList.Cell>
              <EntityList.TextCell>{formatDate(ds.updatedAt)}</EntityList.TextCell>
              {rowLayout.showExperimentsPlaceholder ? <EntityList.Cell className="justify-center" /> : null}
              {rowLayout.showReviewPlaceholderInLink ? <EntityList.Cell className="justify-center" /> : null}
            </EntityList.RowLink>

            {hasExperimentsAction ? (
              <Button
                as={Link}
                to={`${paths.datasetLink(ds.id)}?tab=experiments`}
                variant="ghost"
                size="sm"
                className="w-full  rounded-lg h-full p-0!"
              >
                <Chip color={experimentsChipColor}>
                  {ds.experimentCount} ({ds.successPct ?? 0}%)
                </Chip>
              </Button>
            ) : null}

            {review ? (
              <Button
                as={Link}
                to={`${paths.datasetLink(ds.id)}?tab=review`}
                variant="ghost"
                size="sm"
                className="w-full  rounded-lg h-full p-0!"
              >
                {review.needsReview > 0 ? (
                  <Chip color="yellow">{review.needsReview} pending</Chip>
                ) : (
                  <Chip color="green">{review.complete} reviewed</Chip>
                )}
              </Button>
            ) : rowLayout.showReviewPlaceholderAfterExperiments ? (
              <EntityList.Cell className="justify-center" />
            ) : null}
          </EntityList.RowWrapper>
        );
      })}

      <EntityList.Pagination
        currentPage={currentPage}
        hasMore={hasMore}
        onNextPage={onNextPage}
        onPrevPage={onPrevPage}
      />
    </EntityList>
  );
}
