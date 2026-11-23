'use client';

import type { DatasetExperimentResult } from '@mastra/client-js';
import { useMemo, useState } from 'react';
import { Combobox } from '@/ds/components/Combobox';
import type { ComboboxOption, ComboboxVariant } from '@/ds/components/Combobox';
import { IconCheckmark2Medium } from '@/ds/icons/central/IconCheckmark2Medium';

const CREATE_TAG_VALUE = '__create_tag__';

export interface ExperimentResultsTagPickerProps {
  selectedResults: Array<Pick<DatasetExperimentResult, 'tags'>>;
  vocabulary: string[];
  onAddTag: (tag: string) => void;
  disabled?: boolean;
  variant?: ComboboxVariant;
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
  variant,
}: ExperimentResultsTagPickerProps) {
  const [search, setSearch] = useState('');

  const sortedVocabulary = useMemo(() => [...vocabulary].sort(), [vocabulary]);

  // Tags present on every selected result: selecting them again is a no-op.
  const appliedToAll = useMemo(() => {
    const [first, ...rest] = selectedResults;
    if (!first) return new Set<string>();
    return new Set((first.tags ?? []).filter(tag => rest.every(r => (r.tags ?? []).includes(tag))));
  }, [selectedResults]);

  const options = useMemo<ComboboxOption[]>(() => {
    const existing = sortedVocabulary.map(tag => ({
      label: tag,
      value: tag,
      end: appliedToAll.has(tag) ? (
        <IconCheckmark2Medium data-testid="tag-applied" className="size-icon-sm" />
      ) : undefined,
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
      placeholder="Add tag"
      searchPlaceholder="Search or create tag"
      emptyText="Type to create a tag"
      variant={variant}
      size="sm"
      className="w-auto min-w-0"
      disabled={disabled}
    />
  );
}
