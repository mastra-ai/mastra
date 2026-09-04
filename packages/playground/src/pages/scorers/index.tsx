import { NoDataPageLayout, PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { QueryError } from '@mastra/playground-ui/components/QueryError';
import { useState } from 'react';
import { ScorersToolbar, useScorers } from '@/domains/scores';
import { NoScorersInfo } from '@/domains/scores/components/scorers-list/no-scorers-info';
import { ScorersList } from '@/domains/scores/components/scorers-list/scorers-list';

export default function Scorers() {
  const { data: scorers = {}, isLoading, error } = useScorers();
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');

  if (error) {
    return (
      <NoDataPageLayout>
        <QueryError error={error} resource="scorers" title="Failed to load scorers" />
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
    <PageLayout height="full">
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
