import { ActionRow } from '@mastra/playground-ui/components/ActionRow';
import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
import { ListSearch } from '@mastra/playground-ui/components/ListSearch';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { useUrlSort } from '@mastra/playground-ui/sort/use-url-sort';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { navCrumb } from '@/domains/navigation/crumbs';
import { useStoredPromptBlocks, PromptsList, NoPromptBlocksInfo } from '@/domains/prompt-blocks';
import { PromptBlocksHeaderCreateAction } from '@/domains/prompt-blocks/prompt-blocks-header-actions';

const crumbs = [navCrumb('/prompts')];

const PROMPT_BLOCKS_PER_PAGE = 50;
const PROMPT_BLOCKS_SORT_KEYS = ['updatedAt'] as const;

export default function PromptBlocks() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const { sort, onSortChange: changeUrlSort } = useUrlSort({
    searchParams,
    setSearchParams,
    allowedKeys: PROMPT_BLOCKS_SORT_KEYS,
  });
  const orderBy = useMemo(
    () =>
      sort
        ? { field: sort.key, direction: sort.direction === 'asc' ? ('ASC' as const) : ('DESC' as const) }
        : undefined,
    [sort],
  );
  const { data, isLoading, error, isPlaceholderData } = useStoredPromptBlocks({
    page,
    perPage: PROMPT_BLOCKS_PER_PAGE,
    orderBy,
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
  const handleSortChange = useCallback<typeof changeUrlSort>(
    (direction, key) => {
      changeUrlSort(direction, key);
      setPage(0);
    },
    [changeUrlSort],
  );

  if (error && is401UnauthorizedError(error)) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Prompts</h1>
        <SessionExpired variant="fill" />
      </PageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Prompts</h1>
        <PermissionDenied variant="fill" resource="prompt blocks" />
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Prompts</h1>
        <ErrorState variant="fill" title="Failed to load prompt blocks" message={error.message} />
      </PageLayout>
    );
  }

  if (promptBlocks.length === 0 && !isLoading && page === 0) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Prompts</h1>
        <NoPromptBlocksInfo />
      </PageLayout>
    );
  }

  return (
    <PageLayout
      breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}
      headerActions={<PromptBlocksHeaderCreateAction />}
      actionRow={
        <ActionRow>
          <ActionRow.Start>
            <div className="max-w-120 flex-1">
              <ListSearch
                onSearch={handleSearchChange}
                label="Filter prompts"
                placeholder="Filter by name or description"
              />
            </div>
          </ActionRow.Start>
        </ActionRow>
      }
    >
      <h1 className="sr-only">Prompts</h1>
      <PromptsList
        promptBlocks={promptBlocks}
        isLoading={isLoading}
        search={search}
        currentPage={page}
        hasMore={hasMore}
        onNextPage={handleNextPage}
        onPrevPage={handlePrevPage}
        updatedSort={sort?.direction}
        onSortChange={handleSortChange}
      />
    </PageLayout>
  );
}
