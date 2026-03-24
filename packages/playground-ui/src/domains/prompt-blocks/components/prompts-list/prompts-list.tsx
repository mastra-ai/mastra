import type { StoredPromptBlockResponse } from '@mastra/client-js';
import { CheckIcon } from 'lucide-react';
import { useMemo } from 'react';
import { NoPromptBlocksInfo } from './no-prompt-blocks-info';
import { EntityList, EntityListSkeleton } from '@/ds/components/EntityList';
import { ErrorState } from '@/ds/components/ErrorState';
import { PermissionDenied } from '@/ds/components/PermissionDenied';
import { useLinkComponent } from '@/lib/framework';
import { is403ForbiddenError } from '@/lib/query-utils';
import { truncateString } from '@/lib/truncate-string';

export interface PromptsListProps {
  promptBlocks: StoredPromptBlockResponse[];
  isLoading: boolean;
  error?: Error | null;
  search?: string;
}

export function PromptsList({ promptBlocks, isLoading, error, search = '' }: PromptsListProps) {
  const { paths } = useLinkComponent();

  const filteredData = useMemo(() => {
    const term = search.toLowerCase();
    return promptBlocks.filter(
      block => block.name?.toLowerCase().includes(term) || block.description?.toLowerCase().includes(term),
    );
  }, [promptBlocks, search]);

  if (error && is403ForbiddenError(error)) {
    return <PermissionDenied resource="prompt blocks" />;
  }

  if (error) {
    return <ErrorState title="Failed to load prompt blocks" message={error.message} />;
  }

  if (promptBlocks.length === 0 && !isLoading) {
    return <NoPromptBlocksInfo />;
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

      {filteredData.length === 0 && search ? <EntityList.NoMatch message="No Prompts match your search" /> : null}

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
