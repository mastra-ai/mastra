import type { StoredPromptBlockResponse } from '@mastra/client-js';
import { EntityList, EntityListSkeleton, truncateString } from '@mastra/playground-ui';
import { CheckIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useLinkComponent } from '@/lib/framework';

export interface PromptsListProps {
  promptBlocks: StoredPromptBlockResponse[];
  isLoading: boolean;
  search?: string;
}

export function PromptsList({ promptBlocks, isLoading, search = '' }: PromptsListProps) {
  const { paths, Link } = useLinkComponent();

  const filteredData = useMemo(() => {
    const term = search.toLowerCase();
    return promptBlocks.filter(
      block => block.name?.toLowerCase().includes(term) || block.description?.toLowerCase().includes(term),
    );
  }, [promptBlocks, search]);

  if (isLoading) {
    return <EntityListSkeleton columns="auto 1fr auto auto" />;
  }

  return (
    <EntityList columns="auto 1fr auto auto">
      <EntityList.Top>
        <EntityList.TopCell>Name</EntityList.TopCell>
        <EntityList.TopCell>Description</EntityList.TopCell>
        <EntityList.TopCell className="text-center">Has Draft</EntityList.TopCell>
        <EntityList.TopCell className="text-center">Is Published</EntityList.TopCell>
      </EntityList.Top>

      {filteredData.length === 0 && search ? <EntityList.NoMatch message="No Prompts match your search" /> : null}

      {filteredData.map(block => {
        const name = truncateString(block.name, 50);
        const description = truncateString(block.description ?? '', 200);

        return (
          <EntityList.RowLink key={block.id} to={paths.cmsPromptBlockEditLink(block.id)} LinkComponent={Link}>
            <EntityList.NameCell>{name}</EntityList.NameCell>
            <EntityList.DescriptionCell>{description}</EntityList.DescriptionCell>
            <EntityList.TextCell className="text-center">
              {(block.hasDraft || !block.activeVersionId) && <CheckIcon className="size-4 mx-auto" />}
            </EntityList.TextCell>
            <EntityList.TextCell className="text-center">
              {block.activeVersionId && <CheckIcon className="size-4 mx-auto" />}
            </EntityList.TextCell>
          </EntityList.RowLink>
        );
      })}
    </EntityList>
  );
}
