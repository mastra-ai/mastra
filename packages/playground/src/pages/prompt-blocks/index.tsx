import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
import { ListSearch } from '@mastra/playground-ui/components/ListSearch';
import { NoDataPageLayout, PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { useCallback, useState } from 'react';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { navCrumb } from '@/domains/navigation/crumbs';
import { useStoredPromptBlocks, PromptsList, NoPromptBlocksInfo } from '@/domains/prompt-blocks';
import { PromptBlocksHeaderCreateAction } from '@/domains/prompt-blocks/prompt-blocks-header-actions';

const crumbs = [navCrumb('/prompts')];

const PROMPT_BLOCKS_PER_PAGE = 50;

export default function PromptBlocks() {
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

  if (error && is401UnauthorizedError(error)) {
    return (
      <NoDataPageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <NoDataPageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <PermissionDenied resource="prompt blocks" />
      </NoDataPageLayout>
    );
  }

  if (error) {
    return (
      <NoDataPageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <ErrorState title="Failed to load prompt blocks" message={error.message} />
      </NoDataPageLayout>
    );
  }

  if (promptBlocks.length === 0 && !isLoading && page === 0) {
    return (
      <NoDataPageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />} actions={<PromptBlocksHeaderCreateAction />}>
        <NoPromptBlocksInfo />
      </NoDataPageLayout>
    );
  }

  return (
    <PageLayout
      breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}
      actions={<PromptBlocksHeaderCreateAction />}
      className="grid grid-rows-[auto_minmax(0,1fr)] p-4"
    >
      <PageLayout.TopArea>
        <PageLayout.Row align="center" stack="responsive">
          <div className="max-w-120 flex-1">
            <ListSearch
              onSearch={handleSearchChange}
              label="Filter prompts"
              placeholder="Filter by name or description"
            />
          </div>
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
