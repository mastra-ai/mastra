import type { GetScorerResponse } from '@mastra/client-js';
import { EntityList } from '@/ds/components/EntityList';
import { EntityListSkeleton } from '@/ds/components/EntityList';
import { NoScorersInfo } from './no-scorers-info';
import { ErrorState } from '@/ds/components/ErrorState';
import { PermissionDenied } from '@/ds/components/PermissionDenied';
import { is403ForbiddenError } from '@/lib/query-utils';
import { useLinkComponent } from '@/lib/framework';
import { truncateString } from '@/lib/truncate-string';
import { useMemo } from 'react';

export interface ScorersListProps {
  scorers: Record<string, GetScorerResponse>;
  isLoading: boolean;
  error?: Error | null;
  search?: string;
}

export function ScorersList({
  scorers,
  isLoading,
  error,
  search = '',
}: ScorersListProps) {
  const { paths } = useLinkComponent();

  const scorersData = useMemo(
    () =>
      Object.keys(scorers).map(key => ({
        ...scorers[key],
        id: key,
      })),
    [scorers],
  );

  const filteredData = useMemo(() => {
    const term = search.toLowerCase();
    return scorersData.filter(
      s => s.scorer.config?.id?.toLowerCase().includes(term) || s.scorer.config?.name?.toLowerCase().includes(term),
    );
  }, [scorersData, search]);

  if (error && is403ForbiddenError(error)) {
    return <PermissionDenied resource="scorers" />;
  }

  if (error) {
    return <ErrorState title="Failed to load scorers" message={error.message} />;
  }

  if (scorersData.length === 0 && !isLoading) {
    return <NoScorersInfo />;
  }

  if (isLoading) {
    return <EntityListSkeleton columns="auto 1fr auto auto" />;
  }

  return (
    <EntityList columns="auto 1fr auto auto">
      <EntityList.Top>
        <EntityList.TopCell>Name</EntityList.TopCell>
        <EntityList.TopCell>Description</EntityList.TopCell>
        <EntityList.TopCell className="text-center">Agents</EntityList.TopCell>
        <EntityList.TopCell className="text-center">Workflows</EntityList.TopCell>
      </EntityList.Top>

      {filteredData.map(scorer => {
        const name = truncateString(scorer.scorer.config?.name ?? scorer.id, 50);
        const description = truncateString(scorer.scorer.config?.description ?? '', 200);
        const agentsCount = scorer.agentIds?.length ?? 0;
        const workflowsCount = scorer.workflowIds?.length ?? 0;

        return (
          <EntityList.RowLink key={scorer.id} to={paths.scorerLink(scorer.id)}>
            <EntityList.NameCell>{name}</EntityList.NameCell>
            <EntityList.DescriptionCell>{description}</EntityList.DescriptionCell>
            <EntityList.TextCell className="text-center">{agentsCount || ''}</EntityList.TextCell>
            <EntityList.TextCell className="text-center">{workflowsCount || ''}</EntityList.TextCell>
          </EntityList.RowLink>
        );
      })}
    </EntityList>
  );
}
