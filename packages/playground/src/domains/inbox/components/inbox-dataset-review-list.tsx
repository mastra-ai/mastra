import { DataListSkeleton } from '@mastra/playground-ui/components/DataList';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
import { ListSearch } from '@mastra/playground-ui/components/ListSearch';
import { CircleSlashIcon } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ExperimentResultsList } from '@/domains/experiments/components/experiment-results-list';
import type { InboxDatasetReviewItem } from '@/domains/review/hooks/use-inbox-review-items';
import { experimentReviewQueueLink } from '@/lib/app-routing';

const INBOX_LIST_COLUMNS = [
  { name: 'itemId', label: 'Item ID', size: 'auto' },
  { name: 'status', label: 'Status', size: 'auto' },
  { name: 'input', label: 'Input', size: 'minmax(0,1fr)' },
  { name: 'comment', label: 'Comment', size: 'minmax(0,16rem)' },
  { name: 'tags', label: 'Tags', size: 'auto' },
];
const SKELETON_COLUMNS = INBOX_LIST_COLUMNS.map(c => c.size).join(' ');

export interface InboxDatasetReviewListProps {
  items: InboxDatasetReviewItem[];
  isLoading: boolean;
  error?: Error;
}

export function InboxDatasetReviewList({ items, isLoading, error }: InboxDatasetReviewListProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const term = search.trim().toLowerCase();
  const filtered = term
    ? items.filter(item =>
        [item.itemId, item.experimentId, item.datasetId, item.traceId ?? ''].some(value =>
          value.toLowerCase().includes(term),
        ),
      )
    : items;

  if (isLoading) {
    return <DataListSkeleton columns={SKELETON_COLUMNS} />;
  }

  if (error) {
    return <ErrorState title="Failed to load dataset items" message={error.message} />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        iconSlot={<CircleSlashIcon className="text-neutral3 h-8 w-8" />}
        titleSlot="Nothing to review"
        descriptionSlot="Experiment results that need review will show up here."
      />
    );
  }

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-4">
      <div className="max-w-120">
        <ListSearch
          onSearch={setSearch}
          label="Filter dataset items"
          placeholder="Filter by item, experiment, dataset or trace"
          shortcutDisabled
        />
      </div>

      <div className="min-h-0 overflow-hidden">
        <ExperimentResultsList
          results={filtered}
          isLoading={false}
          featuredResultId={null}
          onResultClick={resultId => {
            const item = filtered.find(i => i.id === resultId);
            if (item) void navigate(experimentReviewQueueLink(item.experimentId, item.id));
          }}
          columns={INBOX_LIST_COLUMNS}
          emptyMessage="No dataset items match your search"
        />
      </div>
    </div>
  );
}
