import { Button } from '@mastra/playground-ui/components/Button';
import { DataList, DataListSkeleton, useDataListKeyboard } from '@mastra/playground-ui/components/DataList';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
import { ListSearch } from '@mastra/playground-ui/components/ListSearch';
import { Inbox } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { InboxDatasetReviewItem } from '@/domains/review/hooks/use-inbox-review-items';

const COLUMNS = 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) auto';

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

  const { containerRef, getRowProps } = useDataListKeyboard({ count: filtered.length });

  if (isLoading) {
    return <DataListSkeleton columns={COLUMNS} />;
  }

  if (error) {
    return <ErrorState title="Failed to load dataset items" message={error.message} />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        iconSlot={<Inbox className="text-neutral3 h-8 w-8" />}
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
        <DataList columns={COLUMNS} variant="striped" fit="container" scrollRef={containerRef}>
          <DataList.Top>
            <DataList.TopCell>Item</DataList.TopCell>
            <DataList.TopCell>Experiment</DataList.TopCell>
            <DataList.TopCell>Dataset</DataList.TopCell>
            <DataList.TopCell>Trace</DataList.TopCell>
            <DataList.TopCell>&nbsp;</DataList.TopCell>
          </DataList.Top>

          {filtered.length === 0 ? (
            <DataList.NoMatch message="No dataset items match your search" />
          ) : (
            filtered.map((item, index) => {
              // Reviews live on the experiment page; `?review=` features this result on its Reviews tab.
              const reviewHref = `/experiments/${encodeURIComponent(item.experimentId)}?review=${encodeURIComponent(item.id)}`;
              return (
                <DataList.RowWrapper key={item.id}>
                  <DataList.RowButton colEnd={-2} onClick={() => navigate(reviewHref)} {...getRowProps(index)}>
                    <DataList.TextCell font="mono">{item.itemId}</DataList.TextCell>
                    <DataList.TextCell font="mono">{item.experimentId}</DataList.TextCell>
                    <DataList.TextCell font="mono">{item.datasetId}</DataList.TextCell>
                    <DataList.TextCell font="mono">{item.traceId ?? '—'}</DataList.TextCell>
                  </DataList.RowButton>
                  <DataList.ActionsCell className="pl-2">
                    {item.traceId ? (
                      <Button
                        as={Link}
                        to={`/traces?traceId=${encodeURIComponent(item.traceId)}`}
                        variant="ghost"
                        size="sm"
                      >
                        Open trace
                      </Button>
                    ) : null}
                  </DataList.ActionsCell>
                </DataList.RowWrapper>
              );
            })
          )}
        </DataList>
      </div>
    </div>
  );
}
