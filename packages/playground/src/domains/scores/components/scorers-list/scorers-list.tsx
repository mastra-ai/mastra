import type { GetScorerResponse } from '@mastra/client-js';
import { Badge, Chip, EntityList, EntityListSkeleton, AgentIcon } from '@mastra/playground-ui';
import { WorkflowIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useLinkComponent } from '@/lib/framework';

export interface ScorersListProps {
  scorers: Record<string, GetScorerResponse>;
  isLoading: boolean;
  search?: string;
  sourceFilter?: string;
}

export const SCORER_SOURCE_OPTIONS = [
  { value: 'all', label: 'All sources' },
  { value: 'code', label: 'Code' },
  { value: 'stored', label: 'Stored' },
] as const;

const COLUMNS = 'auto 1fr auto auto auto';

export function ScorersList({ scorers, isLoading, search = '', sourceFilter = 'all' }: ScorersListProps) {
  const { paths, Link } = useLinkComponent();

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
        const isTrajectory = scorer.scorer.config?.type === 'trajectory';

        return (
          <EntityList.RowLink key={scorer.id} to={paths.scorerLink(scorer.id)} LinkComponent={Link}>
            <EntityList.NameCell>
              <span className="flex items-center gap-1.5">
                {name}
                {isTrajectory && (
                  <Chip size="small" color="purple">
                    trajectory
                  </Chip>
                )}
              </span>
            </EntityList.NameCell>
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
