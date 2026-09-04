import type { GetScorerResponse } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import {
  DataList as EntityList,
  DataListSkeleton as EntityListSkeleton,
  useDataListKeyboard,
} from '@mastra/playground-ui/components/DataList';
import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { WorkflowIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useLinkComponent } from '@/lib/framework';

export interface ScorersListProps {
  scorers: Record<string, GetScorerResponse>;
  isLoading: boolean;
  search?: string;
  sourceFilter?: string;
}

const COLUMNS = 'minmax(0,1fr) minmax(0,1.5fr) auto auto auto';

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

  const { containerRef, getRowProps } = useDataListKeyboard({ count: filteredData.length });

  if (isLoading) {
    return <EntityListSkeleton columns={COLUMNS} />;
  }

  return (
    <EntityList columns={COLUMNS} scrollRef={containerRef}>
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

      {filteredData.map((scorer, index) => {
        const name = scorer.scorer.config?.name || scorer.id;
        const description = scorer.scorer.config?.description || '';
        const agentCount = scorer.agentIds?.length ?? 0;
        const workflowCount = scorer.workflowIds?.length ?? 0;
        const isTrajectory = scorer.scorer.config?.type === 'trajectory';

        return (
          <EntityList.RowLink
            key={scorer.id}
            to={paths.scorerLink(scorer.id)}
            LinkComponent={Link}
            {...getRowProps(index)}
          >
            <EntityList.NameCell>
              <span className="flex max-w-full min-w-0 items-center gap-1.5">
                <span className="min-w-0 truncate">{name}</span>
                {isTrajectory && (
                  <Badge size="xs" variant="purple" className="shrink-0">
                    trajectory
                  </Badge>
                )}
              </span>
            </EntityList.NameCell>
            <EntityList.DescriptionCell>{description}</EntityList.DescriptionCell>
            <EntityList.Cell>
              <Badge size="xs" variant={scorer.source === 'code' ? 'blue' : 'neutral'}>
                {scorer.source}
              </Badge>
            </EntityList.Cell>
            <EntityList.TextCell className="text-center">{agentCount || ''}</EntityList.TextCell>
            <EntityList.TextCell className="text-center">{workflowCount || ''}</EntityList.TextCell>
          </EntityList.RowLink>
        );
      })}
    </EntityList>
  );
}
