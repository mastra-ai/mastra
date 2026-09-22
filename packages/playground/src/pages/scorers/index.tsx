import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { useState } from 'react';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { navCrumb } from '@/domains/navigation/crumbs';
import { ScorersToolbar, useScorers } from '@/domains/scores';
import { NoScorersInfo } from '@/domains/scores/components/scorers-list/no-scorers-info';
import { ScorersList } from '@/domains/scores/components/scorers-list/scorers-list';
import type { ScorersSort } from '@/domains/scores/components/scorers-list/scorers-list';
import { ScorersHeaderCreateAction } from '@/domains/scores/scorers-header-actions';

const crumbs = [navCrumb('/scorers')];

export default function Scorers() {
  const { data: scorers = {}, isLoading, error } = useScorers();
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [sort, setSort] = useState<ScorersSort>();

  if (error && is401UnauthorizedError(error)) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <SessionExpired variant="fill" />
      </PageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <PermissionDenied variant="fill" resource="scorers" />
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <ErrorState variant="fill" title="Failed to load scorers" message={error.message} />
      </PageLayout>
    );
  }

  if (Object.keys(scorers).length === 0 && !isLoading) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />} headerActions={<ScorersHeaderCreateAction />}>
        <NoScorersInfo />
      </PageLayout>
    );
  }

  const hasFilters = sourceFilter !== 'all' || search !== '';

  const resetFilters = () => {
    setSearch('');
    setSourceFilter('all');
  };

  return (
    <PageLayout
      breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}
      headerActions={<ScorersHeaderCreateAction />}
      actionRow={
        <ScorersToolbar
          search={search}
          onSearchChange={setSearch}
          sourceFilter={sourceFilter}
          onSourceFilterChange={setSourceFilter}
          onReset={resetFilters}
          hasActiveFilters={hasFilters}
        />
      }
    >
      <ScorersList
        scorers={scorers}
        isLoading={isLoading}
        search={search}
        sourceFilter={sourceFilter}
        sort={sort}
        onSortChange={(direction, key) => setSort({ key, direction })}
      />
    </PageLayout>
  );
}
