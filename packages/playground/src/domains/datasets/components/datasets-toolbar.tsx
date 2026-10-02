import { ActionRow } from '@mastra/playground-ui/components/ActionRow';
import { Button } from '@mastra/playground-ui/components/Button';
import { ListSearch } from '@mastra/playground-ui/components/ListSearch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui/components/Select';
import { XIcon } from 'lucide-react';
import { DATASET_EXPERIMENT_OPTIONS } from './datasets-list/helpers';
import type { DatasetTargetType } from './target-type-options';
import { TargetFilter } from '@/domains/shared/components/target-filter';

export interface DatasetsToolbarTagOption {
  value: string;
  label: string;
}

export interface DatasetsToolbarProps {
  search: string;
  onSearchChange: (query: string) => void;
  experimentFilter: string;
  onExperimentFilterChange: (value: string) => void;
  tagFilter: string;
  onTagFilterChange: (value: string) => void;
  tagOptions: DatasetsToolbarTagOption[];
  targetType: DatasetTargetType | '';
  onTargetTypeChange: (type: DatasetTargetType | '') => void;
  targetId: string;
  onTargetIdChange: (id: string) => void;
  onReset?: () => void;
  hasActiveFilters?: boolean;
}

export function DatasetsToolbar({
  search,
  onSearchChange,
  experimentFilter,
  onExperimentFilterChange,
  tagFilter,
  onTagFilterChange,
  tagOptions,
  targetType,
  onTargetTypeChange,
  targetId,
  onTargetIdChange,
  onReset,
  hasActiveFilters,
}: DatasetsToolbarProps) {
  return (
    <ActionRow>
      <ActionRow.Start>
        <div className="max-w-120 flex-1">
          <ListSearch
            label="Search datasets"
            placeholder="Filter by dataset name"
            value={search}
            onSearch={onSearchChange}
          />
        </div>
        <TargetFilter
          targetType={targetType}
          targetId={targetId}
          onTargetTypeChange={onTargetTypeChange}
          onTargetIdChange={onTargetIdChange}
        />
        <Select value={experimentFilter} onValueChange={onExperimentFilterChange}>
          <SelectTrigger aria-label="Experiments" size="md" className="whitespace-nowrap">
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent>
            {DATASET_EXPERIMENT_OPTIONS.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {tagOptions.length > 1 && (
          <Select value={tagFilter} onValueChange={onTagFilterChange}>
            <SelectTrigger aria-label="Tags" size="md" className="whitespace-nowrap">
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {tagOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {onReset && hasActiveFilters && (
          <Button onClick={onReset} size="sm" variant="default" icon={<XIcon />}>
            Reset
          </Button>
        )}
      </ActionRow.Start>
    </ActionRow>
  );
}
