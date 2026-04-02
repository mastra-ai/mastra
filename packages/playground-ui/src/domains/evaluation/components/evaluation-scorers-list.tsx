import type { GetScorerResponse } from '@mastra/client-js';
import { WorkflowIcon } from 'lucide-react';
import { useMemo } from 'react';
import { Badge } from '@/ds/components/Badge';
import { EmptyState } from '@/ds/components/EmptyState';
import { EntityList, EntityListSkeleton } from '@/ds/components/EntityList';
import { ErrorState } from '@/ds/components/ErrorState';
import { PermissionDenied } from '@/ds/components/PermissionDenied';
import { AgentCoinIcon } from '@/ds/icons/AgentCoinIcon';
import { AgentIcon } from '@/ds/icons/AgentIcon';
import { Icon } from '@/ds/icons/Icon';
import { useLinkComponent } from '@/lib/framework';
import { is403ForbiddenError } from '@/lib/query-utils';

export interface EvaluationScorersListProps {
  scorers: Record<string, GetScorerResponse>;
  isLoading: boolean;
  error?: Error | null;
  search?: string;
  sourceFilter?: string;
}

export const EVALUATION_SCORER_SOURCE_OPTIONS = [
  { value: 'all', label: 'All sources' },
  { value: 'code', label: 'Code' },
  { value: 'stored', label: 'Stored' },
] as const;

const COLUMNS = 'auto 1fr auto auto auto';

export function EvaluationScorersList({
  scorers,
  isLoading,
  error,
  search = '',
  sourceFilter = 'all',
}: EvaluationScorersListProps) {
  const { paths } = useLinkComponent();

  const scorerData = useMemo(
    () =>
      Object.entries(scorers).map(([key, scorer]) => ({
        ...scorer,
        id: key,
      })),
    [scorers],
  );

  const filteredData = useMemo(() => {
    const term = search.toLowerCase();
    return scorerData.filter(s => {
      const matchesSearch =
        !term ||
        s.scorer.config?.id?.toLowerCase().includes(term) ||
        s.scorer.config?.name?.toLowerCase().includes(term);
      const matchesSource = sourceFilter === 'all' || s.source === sourceFilter;
      return matchesSearch && matchesSource;
    });
  }, [scorerData, search, sourceFilter]);

  if (error && is403ForbiddenError(error)) {
    return <PermissionDenied resource="scorers" />;
  }

  if (error) {
    return <ErrorState title="Failed to load scorers" message={error.message} />;
  }

  if (scorerData.length === 0 && !isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState
          iconSlot={<AgentCoinIcon />}
          titleSlot="Configure Scorers"
          descriptionSlot="Mastra scorers are not configured yet. You can find more information in the documentation."
          actionSlot={
            <a
              className="inline-flex min-w-32 items-center justify-center gap-2 rounded-lg border border-border1 bg-surface2 px-4 py-2 text-sm font-medium text-icon3 transition-colors hover:bg-surface3"
              href="https://mastra.ai/en/docs/evals/overview"
              target="_blank"
              rel="noreferrer"
            >
              <Icon>
                <AgentIcon />
              </Icon>
              Docs
            </a>
          }
        />
      </div>
    );
  }

  if (isLoading) {
    return <EntityListSkeleton columns={COLUMNS} />;
  }

  return (
    <EntityList columns={COLUMNS}>
      <EntityList.Top>
        <EntityList.TopCell>Name</EntityList.TopCell>
        <EntityList.TopCell>Description</EntityList.TopCell>
        <EntityList.TopCell>Source</EntityList.TopCell>
        <EntityList.TopCellSmart
          long="Agents"
          short={<AgentIcon />}
          tooltip="Number of attached Agents"
          className="text-center"
        />
        <EntityList.TopCellSmart
          long="Workflows"
          short={<WorkflowIcon />}
          tooltip="Number of attached Workflows"
          className="text-center"
        />
      </EntityList.Top>

      {filteredData.map(scorer => {
        const name = scorer.scorer.config?.name || scorer.id;
        const description = scorer.scorer.config?.description || '';
        const agentCount = scorer.agentIds?.length ?? 0;
        const workflowCount = scorer.workflowIds?.length ?? 0;

        return (
          <EntityList.RowLink key={scorer.id} to={paths.scorerLink(scorer.id)}>
            <EntityList.NameCell>{name}</EntityList.NameCell>
            <EntityList.DescriptionCell>{description}</EntityList.DescriptionCell>
            <EntityList.Cell>
              <Badge variant={scorer.source === 'code' ? 'info' : 'default'}>{scorer.source}</Badge>
            </EntityList.Cell>
            <EntityList.TextCell className="text-center">{agentCount || ''}</EntityList.TextCell>
            <EntityList.TextCell className="text-center">{workflowCount || ''}</EntityList.TextCell>
          </EntityList.RowLink>
        );
      })}
    </EntityList>
  );
}
