import { ActionRow } from '@mastra/playground-ui/components/ActionRow';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { ListSearch } from '@mastra/playground-ui/components/ListSearch';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/domains/auth/components/permission-denied';
import { SessionExpired } from '@mastra/playground-ui/domains/auth/components/session-expired';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { useState } from 'react';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { navCrumb } from '@/domains/navigation/crumbs';
import { NoProcessorsInfo } from '@/domains/processors/components/processors-list/no-processors-info';
import { ProcessorsList } from '@/domains/processors/components/processors-list/processors-list';
import type { ProcessorsSort } from '@/domains/processors/components/processors-list/processors-list';
import { useProcessors } from '@/domains/processors/hooks/use-processors';

const crumbs = [navCrumb('/processors')];

export function Processors() {
  const { data: processors = {}, isLoading, error } = useProcessors();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<ProcessorsSort>();

  if (error && is401UnauthorizedError(error)) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Processors</h1>
        <SessionExpired variant="fill" />
      </PageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Processors</h1>
        <PermissionDenied variant="fill" resource="processors" />
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Processors</h1>
        <EmptyState tone="error" variant="fill" titleSlot="Failed to load processors" descriptionSlot={error.message} />
      </PageLayout>
    );
  }

  if (Object.keys(processors).length === 0 && !isLoading) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Processors</h1>
        <NoProcessorsInfo />
      </PageLayout>
    );
  }

  return (
    <PageLayout
      breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}
      actionRow={
        <ActionRow>
          <ActionRow.Start>
            <div className="max-w-120 flex-1">
              <ListSearch onSearch={setSearch} label="Filter processors" placeholder="Filter by name" />
            </div>
          </ActionRow.Start>
        </ActionRow>
      }
    >
      <h1 className="sr-only">Processors</h1>
      <ProcessorsList
        processors={processors}
        isLoading={isLoading}
        search={search}
        sort={sort}
        onSortChange={(direction, key) => setSort({ key, direction })}
      />
    </PageLayout>
  );
}
