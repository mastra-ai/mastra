import type { StoredPromptBlockResponse } from '@mastra/client-js';
import {
  DataList as EntityList,
  DataListSkeleton as EntityListSkeleton,
  useDataListKeyboard,
} from '@mastra/playground-ui/components/DataList';
import { truncateString } from '@mastra/playground-ui/utils/truncate-string';
import { CheckIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useLinkComponent } from '@/lib/framework';

export interface PromptsListProps {
  promptBlocks: StoredPromptBlockResponse[];
  isLoading: boolean;
  search?: string;
  currentPage?: number;
  hasMore?: boolean;
  onNextPage?: () => void;
  onPrevPage?: () => void;
}

export function PromptsList({
  promptBlocks,
  isLoading,
  search = '',
  currentPage,
  hasMore,
  onNextPage,
  onPrevPage,
}: PromptsListProps) {
  const { paths, Link } = useLinkComponent();

  const filteredData = useMemo(() => {
    const term = search.toLowerCase();
    return promptBlocks.filter(
      block => block.name?.toLowerCase().includes(term) || block.description?.toLowerCase().includes(term),
    );
  }, [promptBlocks, search]);

  const { containerRef, getRowProps } = useDataListKeyboard({ count: filteredData.length });

  if (isLoading) {
    return <EntityListSkeleton columns="auto 1fr auto auto" />;
  }

  return (
    <EntityList columns="auto 1fr auto auto" scrollRef={containerRef}>
      <EntityList.Top>
        <EntityList.TopCell>Name</EntityList.TopCell>
        <EntityList.TopCell>Description</EntityList.TopCell>
        <EntityList.TopCell className="text-center">Has Draft</EntityList.TopCell>
        <EntityList.TopCell className="text-center">Is Published</EntityList.TopCell>
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
