import {
  Button,
  NoDataPageLayout,
  PageLayout,
  is401UnauthorizedError,
  is403ForbiddenError,
} from '@mastra/playground-ui';
import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
import { ListSearch } from '@mastra/playground-ui/components/ListSearch';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { Plus } from 'lucide-react';
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
      <NoDataPageLayout>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <NoDataPageLayout>
        <PermissionDenied resource="prompt blocks" />
      </NoDataPageLayout>
    );
  }

  if (error) {
    return (
      <NoDataPageLayout>
        <ErrorState title="Failed to load prompt blocks" message={error.message} />
      </NoDataPageLayout>
    );
  }

  if (promptBlocks.length === 0 && !isLoading) {
    return (
      <NoDataPageLayout>
        <NoPromptBlocksInfo />
      </NoDataPageLayout>
    );
  }

  return (
    <PageLayout>
      <PageLayout.TopArea>
        <PageLayout.Row align="center" stack="responsive">
          <div className="max-w-120 flex-1">
            <ListSearch onSearch={setSearch} label="Filter prompts" placeholder="Filter by name or description" />
          </div>
          {isCmsAvailable && (
            <Button as={Link} to={paths.cmsPromptBlockCreateLink()} variant="primary" className="shrink-0">
              <Plus />
              Create Prompt
            </Button>
          )}
        </PageLayout.Row>
      </PageLayout.TopArea>

      <PromptsList promptBlocks={promptBlocks} isLoading={isLoading} search={search} />
    </PageLayout>
  );
}
