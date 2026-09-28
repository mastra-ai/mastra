import type { StoredPromptBlockResponse } from '@mastra/client-js';
import {
  DataList as EntityList,
  DataListSkeleton as EntityListSkeleton,
  useDataListKeyboard,
} from '@mastra/playground-ui/components/DataList';
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
    return <EntityListSkeleton columns={COLUMNS} />;
  }

  return (
    <EntityList columns={COLUMNS} scrollRef={containerRef}>
      <EntityList.Top>
        <EntityList.TopCell>Name</EntityList.TopCell>
        <EntityList.TopCell>Description</EntityList.TopCell>
        <EntityList.TopCell className="text-center">Has Draft</EntityList.TopCell>
        <EntityList.TopCell className="text-center">Is Published</EntityList.TopCell>
        {onSortChange ? (
          <EntityList.SortableTopCell sortKey="updatedAt" sort={updatedSort} onSortChange={onSortChange}>
            Updated
          </EntityList.SortableTopCell>
        ) : (
          <EntityList.TopCell>Updated</EntityList.TopCell>
        )}
      </EntityList.Top>

      {filteredData.length === 0 && search ? <EntityList.NoMatch message="No Prompts match your search" /> : null}

      {filteredData.map((block, index) => {
        const name = truncateString(block.name, 50);
        const description = truncateString(block.description ?? '', 200);

        return (
          <EntityList.RowLink
            key={block.id}
            to={paths.cmsPromptBlockEditLink(block.id)}
            LinkComponent={Link}
            {...getRowProps(index)}
          >
            <EntityList.NameCell>{name}</EntityList.NameCell>
            <EntityList.DescriptionCell>{description}</EntityList.DescriptionCell>
            <EntityList.TextCell className="text-center">
              {(block.hasDraft || !block.activeVersionId) && <CheckIcon className="mx-auto size-4" />}
            </EntityList.TextCell>
            <EntityList.TextCell className="text-center">
              {block.activeVersionId && <CheckIcon className="mx-auto size-4" />}
            </EntityList.TextCell>
            <EntityList.DateCell timestamp={block.updatedAt} />
          </EntityList.RowLink>
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
