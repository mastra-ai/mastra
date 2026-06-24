import { NoDataPageLayout, PageLayout, is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui';
import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { useState } from 'react';
import { ScorersToolbar, useScorers } from '@/domains/scores';
import { NoScorersInfo } from '@/domains/scores/components/scorers-list/no-scorers-info';
import { ScorersList } from '@/domains/scores/components/scorers-list/scorers-list';

export default function Scorers() {
  const { data: scorers = {}, isLoading, error } = useScorers();
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');

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
        <PermissionDenied resource="scorers" />
      </NoDataPageLayout>
    );
  }

  if (error) {
    return (
      <NoDataPageLayout>
        <ErrorState title="Failed to load scorers" message={error.message} />
      </NoDataPageLayout>
    );
  }

  if (Object.keys(scorers).length === 0 && !isLoading) {
    return (
      <NoDataPageLayout>
        <NoScorersInfo />
      </NoDataPageLayout>
    );
  }

  const hasFilters = sourceFilter !== 'all' || search !== '';

  const resetFilters = () => {
    setSearch('');
    setSourceFilter('all');
  };

  return (
    <PageLayout>
      <PageLayout.TopArea>
        <ScorersToolbar
          search={search}
          onSearchChange={setSearch}
          sourceFilter={sourceFilter}
          onSourceFilterChange={setSourceFilter}
          onReset={resetFilters}
          hasActiveFilters={hasFilters}
        />
      </PageLayout.TopArea>

      <ScorersList scorers={scorers} isLoading={isLoading} search={search} sourceFilter={sourceFilter} />
    </PageLayout>
  );
}
