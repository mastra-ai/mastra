import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
import { ListSearch } from '@mastra/playground-ui/components/ListSearch';
import { NoDataPageLayout, PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { useState } from 'react';
import { pageHeaderProps } from '@/components/ui/page-header-props';
import { navCrumb } from '@/domains/navigation/crumbs';
import { NoProcessorsInfo } from '@/domains/processors/components/processors-list/no-processors-info';
import { ProcessorsList } from '@/domains/processors/components/processors-list/processors-list';
import { useProcessors } from '@/domains/processors/hooks/use-processors';

const crumbs = [navCrumb('/processors')];

export function Processors() {
  const { data: processors = {}, isLoading, error } = useProcessors();
  const [search, setSearch] = useState('');

  if (error && is401UnauthorizedError(error)) {
    return (
      <NoDataPageLayout {...pageHeaderProps(crumbs)}>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <NoDataPageLayout {...pageHeaderProps(crumbs)}>
        <PermissionDenied resource="processors" />
      </NoDataPageLayout>
    );
  }

  if (error) {
    return (
      <NoDataPageLayout {...pageHeaderProps(crumbs)}>
        <ErrorState title="Failed to load processors" message={error.message} />
      </NoDataPageLayout>
    );
  }

  if (Object.keys(processors).length === 0 && !isLoading) {
    return (
      <NoDataPageLayout {...pageHeaderProps(crumbs)}>
        <NoProcessorsInfo />
      </NoDataPageLayout>
    );
  }

  return (
    <PageLayout {...pageHeaderProps(crumbs)} height="full">
      <PageLayout.TopArea>
        <div className="max-w-120">
          <ListSearch onSearch={setSearch} label="Filter processors" placeholder="Filter by name" />
        </div>
      </PageLayout.TopArea>

      <ProcessorsList processors={processors} isLoading={isLoading} search={search} />
    </PageLayout>
  );
}
