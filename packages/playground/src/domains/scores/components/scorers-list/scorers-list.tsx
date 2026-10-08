import type { GetScorerResponse, RouteResponse } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { DataList, DataListSkeleton, useDataListKeyboard } from '@mastra/playground-ui/components/DataList';
import type { DataListSort, DataListScroll } from '@mastra/playground-ui/components/DataList';
import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { sortBy } from '@mastra/playground-ui/sort/sort-by';
import type { ListSort } from '@mastra/playground-ui/sort/sort-by';
import { WorkflowIcon } from 'lucide-react';
import { useMemo } from 'react';

export type ScorersListItem = GetScorerResponse & { id: string };

export type ScorersSortKey = 'name' | 'source' | 'agents' | 'workflows';
export type ScorersSort = ListSort<ScorersSortKey>;

const sortAccessors = {
  name: (scorer: ScorersListItem) => scorer.scorer.config?.name || scorer.id,
  source: (scorer: ScorersListItem) => scorer.source,
  agents: (scorer: ScorersListItem) => scorer.agentIds?.length ?? 0,
  workflows: (scorer: ScorersListItem) => scorer.workflowIds?.length ?? 0,
};

export interface ScorersListProps {
  scroll?: DataListScroll;
  scorers: RouteResponse<'GET /scores/scorers'>;
  isLoading: boolean;
  search?: string;
  sourceFilter?: string;
  sort?: ScorersSort;
  onSortChange?: (direction: DataListSort, key: ScorersSortKey) => void;
  /** When provided, rows become buttons that call this instead of navigating to the scorer page. */
  onSelectScorer?: (scorer: ScorersListItem) => void;
  /** Highlights the row for the given scorer id (used with `onSelectScorer`). */
  selectedScorerId?: string;
  /** Whether keyboard roving is bound globally. Defaults to `true`. */
  keyboardGlobal?: boolean;
}

const COLUMNS = 'minmax(0,1fr) minmax(0,1.5fr) auto auto auto';

export function ScorersList({
  scroll,
  scorers,
  isLoading,
  search = '',
  sourceFilter = 'all',
  sort,
  onSortChange,
  onSelectScorer,
  selectedScorerId,
  keyboardGlobal = true,
}: ScorersListProps) {
  const { paths, Link } = useLinkComponent();

  const scorerData = useMemo<ScorersListItem[]>(
    () =>
      Object.entries(scorers).map(([key, scorer]) => ({
        ...scorer,
        id: key,
      })),
    [scorers],
  );

  const filteredData = useMemo(() => {
    const term = search.toLowerCase();
    const filtered = scorerData.filter(s => {
      const matchesSearch =
        !term ||
        s.scorer.config?.id?.toLowerCase().includes(term) ||
        s.scorer.config?.name?.toLowerCase().includes(term);
      const matchesSource = sourceFilter === 'all' || s.source === sourceFilter;
      return matchesSearch && matchesSource;
    });
    return sortBy(filtered, sort, sortAccessors);
  }, [scorerData, search, sourceFilter, sort]);

  const { containerRef, getRowProps } = useDataListKeyboard({ count: filteredData.length, global: keyboardGlobal });

  if (isLoading) {
    return <DataListSkeleton scroll={scroll} columns={COLUMNS} />;
  }

  const sortFor = (key: ScorersSortKey) => (sort?.key === key ? sort.direction : undefined);

  return (
    <DataList scroll={scroll} columns={COLUMNS} scrollRef={containerRef}>
      <DataList.Top>
        {onSortChange ? (
          <>
            <DataList.SortableTopCell sortKey="name" sort={sortFor('name')} onSortChange={onSortChange}>
              Name
            </DataList.SortableTopCell>
            <DataList.TopCell>Description</DataList.TopCell>
            <DataList.SortableTopCell sortKey="source" sort={sortFor('source')} onSortChange={onSortChange}>
              Source
            </DataList.SortableTopCell>
            <DataList.SortableTopCell sortKey="agents" sort={sortFor('agents')} onSortChange={onSortChange} align="end">
              Agents
            </DataList.SortableTopCell>
            <DataList.SortableTopCell
              sortKey="workflows"
              sort={sortFor('workflows')}
              onSortChange={onSortChange}
              align="end"
            >
              Workflows
            </DataList.SortableTopCell>
          </>
        ) : (
          <>
            <DataList.TopCell>Name</DataList.TopCell>
            <DataList.TopCell>Description</DataList.TopCell>
            <DataList.TopCell>Source</DataList.TopCell>
            <DataList.TopCellSmart
              long="Agents"
              short={<AgentIcon />}
              tooltip="Number of attached Agents"
              className="text-center"
            />
            <DataList.TopCellSmart
              long="Workflows"
              short={<WorkflowIcon />}
              tooltip="Number of attached Workflows"
              className="text-center"
            />
          </>
        )}
      </DataList.Top>

      {filteredData.map((scorer, index) => {
        const name = scorer.scorer.config?.name || scorer.id;
        const description = scorer.scorer.config?.description || '';
        const agentCount = scorer.agentIds?.length ?? 0;
        const workflowCount = scorer.workflowIds?.length ?? 0;
        const isTrajectory = scorer.scorer.config?.type === 'trajectory';

        const cells = (
          <>
            <DataList.NameCell>
              <span className="flex max-w-full min-w-0 items-center gap-1.5">
                <span className="min-w-0 truncate">{name}</span>
                {isTrajectory && (
                  <Badge size="xs" variant="purple" className="shrink-0">
                    trajectory
                  </Badge>
                )}
              </span>
            </DataList.NameCell>
            <DataList.DescriptionCell>{description}</DataList.DescriptionCell>
            <DataList.Cell>
              <Badge size="xs" variant={scorer.source === 'code' ? 'blue' : 'neutral'}>
                {scorer.source}
              </Badge>
            </DataList.Cell>
            <DataList.TextCell className="text-center">{agentCount || ''}</DataList.TextCell>
            <DataList.TextCell className="text-center">{workflowCount || ''}</DataList.TextCell>
          </>
        );

        if (onSelectScorer) {
          return (
            <DataList.RowButton
              key={scorer.id}
              featured={selectedScorerId === scorer.id}
              onClick={() => onSelectScorer(scorer)}
              {...getRowProps(index)}
            >
              {cells}
            </DataList.RowButton>
          );
        }

        return (
          <DataList.RowLink
            key={scorer.id}
            to={paths.scorerLink(scorer.id)}
            LinkComponent={Link}
            {...getRowProps(index)}
          >
            {cells}
          </DataList.RowLink>
        );
      })}
    </DataList>
  );
}
