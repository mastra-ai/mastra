import {
  ButtonWithTooltip,
  ErrorState,
  NoDataPageLayout,
  PageHeader,
  PageLayout,
  PermissionDenied,
  SessionExpired,
  is401UnauthorizedError,
  is403ForbiddenError,
} from '@mastra/playground-ui';
import { BookIcon, GaugeIcon } from 'lucide-react';
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
      <NoDataPageLayout title="Scorers" icon={<GaugeIcon />}>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <NoDataPageLayout title="Scorers" icon={<GaugeIcon />}>
        <PermissionDenied resource="scorers" />
      </NoDataPageLayout>
    );
  }

  if (error) {
    return (
      <NoDataPageLayout title="Scorers" icon={<GaugeIcon />}>
        <ErrorState title="Failed to load scorers" message={error.message} />
      </NoDataPageLayout>
    );
  }

  if (Object.keys(scorers).length === 0 && !isLoading) {
    return (
      <NoDataPageLayout title="Scorers" icon={<GaugeIcon />}>
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
        <PageLayout.Row>
          <PageLayout.Column>
            <PageHeader>
              <PageHeader.Title isLoading={isLoading}>
                <GaugeIcon /> Scorers
              </PageHeader.Title>
            </PageHeader>
          </PageLayout.Column>
          <PageLayout.Column className="flex justify-end gap-2">
            <ButtonWithTooltip
              as="a"
              href="https://mastra.ai/en/docs/evals/overview"
              target="_blank"
              rel="noopener noreferrer"
              tooltipContent="Go to Scorers documentation"
            >
              <BookIcon />
            </ButtonWithTooltip>
          </PageLayout.Column>
        </PageLayout.Row>
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
