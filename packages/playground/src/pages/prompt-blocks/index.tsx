import {
  Button,
  ButtonWithTooltip,
  ErrorState,
  ListSearch,
  NoDataPageLayout,
  PageHeader,
  PageLayout,
  PermissionDenied,
  SessionExpired,
  is401UnauthorizedError,
  is403ForbiddenError,
} from '@mastra/playground-ui';
import { BookIcon, FileTextIcon, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useIsCmsAvailable } from '@/domains/cms/hooks/use-is-cms-available';
import { useStoredPromptBlocks, PromptsList, NoPromptBlocksInfo } from '@/domains/prompt-blocks';
import { useLinkComponent } from '@/lib/framework';

export default function PromptBlocks() {
  const { paths } = useLinkComponent();
  const { data, isLoading, error } = useStoredPromptBlocks();
  const { isCmsAvailable } = useIsCmsAvailable();
  const [search, setSearch] = useState('');

  const promptBlocks = data?.promptBlocks ?? [];

  if (error && is401UnauthorizedError(error)) {
    return (
      <NoDataPageLayout title="Prompts" icon={<FileTextIcon />}>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <NoDataPageLayout title="Prompts" icon={<FileTextIcon />}>
        <PermissionDenied resource="prompt blocks" />
      </NoDataPageLayout>
    );
  }

  if (error) {
    return (
      <NoDataPageLayout title="Prompts" icon={<FileTextIcon />}>
        <ErrorState title="Failed to load prompt blocks" message={error.message} />
      </NoDataPageLayout>
    );
  }

  if (promptBlocks.length === 0 && !isLoading) {
    return (
      <NoDataPageLayout title="Prompts" icon={<FileTextIcon />}>
        <NoPromptBlocksInfo />
      </NoDataPageLayout>
    );
  }

  return (
    <PageLayout>
      <PageLayout.TopArea>
        <PageLayout.Row>
          <PageLayout.Column>
            <PageHeader>
              <PageHeader.Title isLoading={isLoading}>
                <FileTextIcon /> Prompts
              </PageHeader.Title>
            </PageHeader>
          </PageLayout.Column>
          <PageLayout.Column className="flex justify-end gap-2">
            <ButtonWithTooltip
              as="a"
              href="https://mastra.ai/en/docs/agents/agent-instructions#prompt-blocks"
              target="_blank"
              rel="noopener noreferrer"
              tooltipContent="Go to Prompts documentation"
            >
              <BookIcon />
            </ButtonWithTooltip>
            {isCmsAvailable && (
              <Button as={Link} to={paths.cmsPromptBlockCreateLink()} variant="primary">
                <Plus />
                Create Prompt
              </Button>
            )}
          </PageLayout.Column>
        </PageLayout.Row>
        <div className="max-w-120">
          <ListSearch onSearch={setSearch} label="Filter prompts" placeholder="Filter by name or description" />
        </div>
      </PageLayout.TopArea>

      <PromptsList promptBlocks={promptBlocks} isLoading={isLoading} search={search} />
    </PageLayout>
  );
}
