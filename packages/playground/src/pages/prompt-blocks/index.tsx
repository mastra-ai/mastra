import { Button } from '@mastra/playground-ui/components/Button';
import { QueryError } from '@mastra/playground-ui/components/QueryError';
import { ListSearch } from '@mastra/playground-ui/components/ListSearch';
import { NoDataPageLayout, PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { Plus } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import { useIsCmsAvailable } from '@/domains/cms/hooks/use-is-cms-available';
import { useStoredPromptBlocks, PromptsList, NoPromptBlocksInfo } from '@/domains/prompt-blocks';
import { useLinkComponent } from '@/lib/framework';

const PROMPT_BLOCKS_PER_PAGE = 50;

export default function PromptBlocks() {
  const { paths } = useLinkComponent();
  const { isCmsAvailable } = useIsCmsAvailable();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const { data, isLoading, error, isPlaceholderData } = useStoredPromptBlocks({
    page,
    perPage: PROMPT_BLOCKS_PER_PAGE,
  });

  const promptBlocks = data?.promptBlocks ?? [];
  const hasMore = data?.hasMore ?? false;

  const handleNextPage = useCallback(() => {
    if (!isPlaceholderData) setPage(p => p + 1);
  }, [isPlaceholderData]);
  const handlePrevPage = useCallback(() => {
    if (!isPlaceholderData) setPage(p => Math.max(0, p - 1));
  }, [isPlaceholderData]);
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(0);
  }, []);

  if (error) {
    return (
      <NoDataPageLayout>
        <QueryError error={error} resource="prompt blocks" title="Failed to load prompt blocks" />
      </NoDataPageLayout>
    );
  }

  if (promptBlocks.length === 0 && !isLoading && page === 0) {
    return (
      <NoDataPageLayout>
        <NoPromptBlocksInfo />
      </NoDataPageLayout>
    );
  }

  return (
    <PageLayout height="full">
      <PageLayout.TopArea>
        <PageLayout.Row align="center" stack="responsive">
          <div className="max-w-120 flex-1">
            <ListSearch
              onSearch={handleSearchChange}
              label="Filter prompts"
              placeholder="Filter by name or description"
            />
          </div>
          {isCmsAvailable && (
            <Button as={Link} to={paths.cmsPromptBlockCreateLink()} variant="primary" className="shrink-0">
              <Plus />
              Create Prompt
            </Button>
          )}
        </PageLayout.Row>
      </PageLayout.TopArea>

      <PromptsList
        promptBlocks={promptBlocks}
        isLoading={isLoading}
        search={search}
        currentPage={page}
        hasMore={hasMore}
        onNextPage={handleNextPage}
        onPrevPage={handlePrevPage}
      />
    </PageLayout>
  );
}
