import type { DatasetExperimentResult } from '@mastra/client-js';
import { Combobox } from '@mastra/playground-ui/components/Combobox';
import type { ComboboxOption } from '@mastra/playground-ui/components/Combobox';
import { Check, Tag } from 'lucide-react';
import { useMemo, useState } from 'react';

const CREATE_TAG_VALUE = '__create_tag__';

export interface ExperimentResultsTagPickerProps {
  selectedResults: Array<Pick<DatasetExperimentResult, 'tags'>>;
  vocabulary: string[];
  onAddTag: (tag: string) => void;
  disabled?: boolean;
  /** `toolbar` (default) for the selection row; `inline` for the compact editor in the result panel. */
  appearance?: 'toolbar' | 'inline';
}

/**
 * "Add tag" combobox for a selection of experiment results. Lists every known
 * tag (checked when already on every selected result) with a first-row
 * `Create "<input>"` option for new ones. Selecting a tag that is already
 * applied to every selected result is a no-op.
 */
export function ExperimentResultsTagPicker({
  selectedResults,
  vocabulary,
  onAddTag,
  disabled,
  appearance = 'toolbar',
}: ExperimentResultsTagPickerProps) {
  const [search, setSearch] = useState('');

  const sortedVocabulary = useMemo(() => [...vocabulary].sort(), [vocabulary]);

  // Tags present on every selected result: selecting them again is a no-op.
  const appliedToAll = useMemo(() => {
    if (selectedResults.length === 0) return new Set<string>();
    const [first, ...rest] = selectedResults;
    return new Set((first.tags ?? []).filter(tag => rest.every(r => (r.tags ?? []).includes(tag))));
  }, [selectedResults]);

  const options = useMemo<ComboboxOption[]>(() => {
    const existing = sortedVocabulary.map(tag => ({
      label: tag,
      value: tag,
      end: appliedToAll.has(tag) ? <Check data-testid="tag-applied" className="size-3.5" /> : undefined,
    }));
    const trimmed = search.trim();
    const canCreate = trimmed.length > 0 && !sortedVocabulary.includes(trimmed);
    return canCreate ? [{ label: `Create "${trimmed}"`, value: CREATE_TAG_VALUE }, ...existing] : existing;
  }, [sortedVocabulary, appliedToAll, search]);

  const handleSelect = (value: string) => {
    const tag = value === CREATE_TAG_VALUE ? search.trim() : value;
    if (!tag || appliedToAll.has(tag)) return;
    onAddTag(tag);
  };

  return (
    <Combobox
      data-testid="experiment-results-tag-picker"
      options={options}
      value={undefined}
      onValueChange={handleSelect}
      onInputValueChange={setSearch}
      placeholder={
        <span className="flex items-center gap-1.5">
          <Tag className="size-3.5" />
          Add tag
        </span>
      }
      searchPlaceholder="Search or create tag..."
      emptyText="Type to create a tag"
      variant={appearance === 'inline' ? 'ghost' : 'outline'}
      size={appearance === 'inline' ? 'xs' : 'md'}
      className="w-auto min-w-0"
      disabled={disabled}
    />
  );
}
