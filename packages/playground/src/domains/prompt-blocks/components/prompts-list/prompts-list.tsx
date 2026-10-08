import type { StoredPromptBlockResponse } from '@mastra/client-js';
import { DataList, DataListSkeleton, useDataListKeyboard } from '@mastra/playground-ui/components/DataList';
import type { DataListSort } from '@mastra/playground-ui/components/DataList';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { truncateString } from '@mastra/playground-ui/utils/truncate-string';
import { CheckIcon } from 'lucide-react';
import { useMemo } from 'react';

export interface PromptsListProps {
  promptBlocks: StoredPromptBlockResponse[];
  isLoading: boolean;
  search?: string;
  currentPage?: number;
  hasMore?: boolean;
  onNextPage?: () => void;
  onPrevPage?: () => void;
  updatedSort?: DataListSort;
  onSortChange?: (sort: DataListSort, key: string) => void;
}

const COLUMNS = 'auto 1fr auto auto auto';

export function PromptsList({
  promptBlocks,
  isLoading,
  search = '',
  currentPage,
  hasMore,
  onNextPage,
  onPrevPage,
  updatedSort,
  onSortChange,
}: PromptsListProps) {
  const { paths, Link } = useLinkComponent();

  const filteredData = useMemo(() => {
    const term = search.toLowerCase();
    return promptBlocks.filter(
      block => block.name?.toLowerCase().includes(term) || block.description?.toLowerCase().includes(term),
    );
  }, [promptBlocks, search]);

  const { containerRef, getRowProps } = useDataListKeyboard({ count: filteredData.length, global: true });

  if (isLoading) {
    return <DataListSkeleton scroll="page" columns={COLUMNS} />;
  }

  return (
    <DataList scroll="page" columns={COLUMNS} scrollRef={containerRef}>
      <DataList.Top>
        <DataList.TopCell>Name</DataList.TopCell>
        <DataList.TopCell>Description</DataList.TopCell>
        <DataList.TopCell className="text-center">Has Draft</DataList.TopCell>
        <DataList.TopCell className="text-center">Is Published</DataList.TopCell>
        {onSortChange ? (
          <DataList.SortableTopCell sortKey="updatedAt" sort={updatedSort} onSortChange={onSortChange}>
            Updated
          </DataList.SortableTopCell>
        ) : (
          <DataList.TopCell>Updated</DataList.TopCell>
        )}
      </DataList.Top>

      {filteredData.length === 0 && search ? <DataList.NoMatch message="No Prompts match your search" /> : null}

      {filteredData.map((block, index) => {
        const name = truncateString(block.name, 50);
        const description = truncateString(block.description ?? '', 200);

        return (
          <DataList.RowLink
            key={block.id}
            to={paths.cmsPromptBlockEditLink(block.id)}
            LinkComponent={Link}
            {...getRowProps(index)}
          >
            <DataList.NameCell>{name}</DataList.NameCell>
            <DataList.DescriptionCell>{description}</DataList.DescriptionCell>
            <DataList.TextCell className="text-center">
              {(block.hasDraft || !block.activeVersionId) && <CheckIcon className="mx-auto size-4" />}
            </DataList.TextCell>
            <DataList.TextCell className="text-center">
              {block.activeVersionId && <CheckIcon className="mx-auto size-4" />}
            </DataList.TextCell>
            <DataList.DateCell timestamp={block.updatedAt} />
          </DataList.RowLink>
        );
      })}

      <DataList.Pagination
        currentPage={currentPage}
        hasMore={hasMore}
        onNextPage={onNextPage}
        onPrevPage={onPrevPage}
      />
    </DataList>
  );
}
