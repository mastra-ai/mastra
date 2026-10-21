import { ActionRow } from '@mastra/playground-ui/components/ActionRow';
import { DatasetsFilterBar } from './datasets-filter-bar';
import type { DatasetsFilters } from './datasets-filter-bar';

export interface DatasetsToolbarTagOption {
  value: string;
  label: string;
}

export interface DatasetsToolbarProps extends DatasetsFilters {
  onFiltersChange: (next: DatasetsFilters) => void;
  tagOptions: DatasetsToolbarTagOption[];
}

export function DatasetsToolbar({
  search,
  experimentFilter,
  tagFilter,
  tagOptions,
  targetType,
  targetId,
  onFiltersChange,
}: DatasetsToolbarProps) {
  return (
    <ActionRow>
      <ActionRow.Start>
        <DatasetsFilterBar
          search={search}
          experimentFilter={experimentFilter}
          tagFilter={tagFilter}
          tagOptions={tagOptions}
          targetType={targetType}
          targetId={targetId}
          onChange={onFiltersChange}
        />
      </ActionRow.Start>
    </ActionRow>
  );
}
