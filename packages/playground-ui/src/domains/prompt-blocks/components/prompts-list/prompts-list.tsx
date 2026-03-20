import type { StoredPromptBlockResponse } from '@mastra/client-js';
import { EntityList } from '@/ds/components/EntityList';
import { EntityListSkeleton } from '@/ds/components/EntityList';
import { EmptyState } from '@/ds/components/EmptyState';
import { Button } from '@/ds/components/Button';
import { useLinkComponent } from '@/lib/framework';
import { truncateString } from '@/lib/truncate-string';
import { useMemo, useState } from 'react';
import { CheckIcon, FileTextIcon } from 'lucide-react';

export interface PromptsListProps {
  promptBlocks: StoredPromptBlockResponse[];
  isLoading: boolean;
  search?: string;
  onSearch?: (search: string) => void;
}

export function PromptsList({
  promptBlocks,
  isLoading,
  search: externalSearch,
  onSearch: externalOnSearch,
}: PromptsListProps) {
  const { paths } = useLinkComponent();
  const [internalSearch, setInternalSearch] = useState('');
  const search = externalSearch ?? internalSearch;

  const filteredData = useMemo(() => {
    const term = search.toLowerCase();
    return promptBlocks.filter(
      block => block.name?.toLowerCase().includes(term) || block.description?.toLowerCase().includes(term),
    );
  }, [promptBlocks, search]);

  if (promptBlocks.length === 0 && !isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState
          iconSlot={<FileTextIcon className="h-8 w-8" />}
          titleSlot="No Prompt Blocks"
          descriptionSlot="Create reusable prompt blocks that can be referenced in your agent instructions."
          actionSlot={
            <Button as="a" href="https://mastra.ai/en/docs/agents/agent-instructions#prompt-blocks" target="_blank">
              <FileTextIcon />
              Docs
            </Button>
          }
        />
      </div>
    );
  }

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

      {filteredData.map(block => {
        const name = truncateString(block.name, 50);
        const description = truncateString(block.description ?? '', 200);

        return (
          <EntityList.RowLink key={block.id} to={paths.cmsPromptBlockEditLink(block.id)}>
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
