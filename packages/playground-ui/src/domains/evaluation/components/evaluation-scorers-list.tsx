import type { GetScorerResponse } from '@mastra/client-js';
import { WorkflowIcon, XIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import { EmptyState } from '@/ds/components/EmptyState';
import { EntityList, EntityListSkeleton } from '@/ds/components/EntityList';
import { ErrorState } from '@/ds/components/ErrorState';
import { SearchFieldBlock } from '@/ds/components/FormFieldBlocks/fields/search-field-block';
import { SelectFieldBlock } from '@/ds/components/FormFieldBlocks/fields/select-field-block';
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
}

const COLUMNS = 'auto 1fr auto auto auto';

const SOURCE_OPTIONS = [
  { value: 'all', label: 'All sources' },
  { value: 'code', label: 'Code' },
  { value: 'stored', label: 'Stored' },
];

export function EvaluationScorersList({ scorers, isLoading, error }: EvaluationScorersListProps) {
  const { paths } = useLinkComponent();
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');

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

  const hasActiveFilters = sourceFilter !== 'all';
  const resetFilters = () => {
    setSearch('');
    setSourceFilter('all');
  };

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
            <Button
              size="lg"
              className="w-full"
              variant="light"
              as="a"
              href="https://mastra.ai/en/docs/evals/overview"
              target="_blank"
            >
              <Icon>
                <AgentIcon />
              </Icon>
              Docs
            </Button>
          }
        />
      </div>
    );
  }

  if (isLoading) {
    return <EntityListSkeleton columns={COLUMNS} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <SearchFieldBlock
          name="search-scorers"
          label="Search scorers"
          labelIsHidden
          placeholder="Filter by scorer name"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onReset={() => setSearch('')}
          className="w-full max-w-80"
        />
        <ButtonsGroup>
          <SelectFieldBlock
            label="Source"
            labelIsHidden
            name="filter-source"
            options={SOURCE_OPTIONS}
            value={sourceFilter}
            onValueChange={setSourceFilter}
            className="whitespace-nowrap"
          />
          {hasActiveFilters && (
            <Button onClick={resetFilters} size="sm" variant="light">
              <XIcon className="size-3" /> Reset
            </Button>
          )}
        </ButtonsGroup>
      </div>
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
    </div>
  );
}
