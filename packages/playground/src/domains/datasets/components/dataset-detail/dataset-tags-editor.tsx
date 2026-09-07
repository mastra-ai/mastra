import { Badge } from '@mastra/playground-ui/components/Badge';
import { Combobox } from '@mastra/playground-ui/components/Combobox';
import type { ComboboxOption } from '@mastra/playground-ui/components/Combobox';
import { toast } from '@mastra/playground-ui/utils/toast';
import { Check, Tag, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import { getAllDatasetTags } from '../datasets-list/helpers';
import { useDatasetMutations } from '@/domains/datasets/hooks/use-dataset-mutations';
import { useDataset, useDatasets } from '@/domains/datasets/hooks/use-datasets';

const CREATE_TAG_VALUE = '__create_tag__';

export interface DatasetTagsEditorProps {
  datasetId: string;
}

/**
 * Inline tag editor for a dataset: current tags as removable badges plus an
 * "Add tag" combobox listing every tag known across datasets (applied ones are
 * checked), with a first-row `Create "<input>"` option for new ones. Every
 * change persists immediately; removal is via the badge only.
 */
export function DatasetTagsEditor({ datasetId }: DatasetTagsEditorProps) {
  const { data: dataset } = useDataset(datasetId);
  const { data: datasetsData } = useDatasets();
  const { updateDataset } = useDatasetMutations();
  const [search, setSearch] = useState('');

  const currentTags = useMemo(() => (Array.isArray(dataset?.tags) ? dataset.tags : []), [dataset?.tags]);
  const allTags = useMemo(() => getAllDatasetTags(datasetsData?.datasets ?? []), [datasetsData?.datasets]);

  const options = useMemo<ComboboxOption[]>(() => {
    const existing = allTags.map(tag => ({
      label: tag,
      value: tag,
      end: currentTags.includes(tag) ? <Check data-testid="tag-applied" className="size-3.5" /> : undefined,
    }));
    const trimmed = search.trim();
    const canCreate = trimmed.length > 0 && !allTags.includes(trimmed) && !currentTags.includes(trimmed);
    return canCreate ? [{ label: `Create "${trimmed}"`, value: CREATE_TAG_VALUE }, ...existing] : existing;
  }, [allTags, currentTags, search]);

  const persistTags = (tags: string[]) => {
    updateDataset.mutate({ datasetId, tags }, { onError: () => toast.error('Failed to update tags') });
  };

  const handleAdd = (value: string) => {
    const tag = value === CREATE_TAG_VALUE ? search.trim() : value;
    if (!tag || currentTags.includes(tag)) return;
    persistTags([...currentTags, tag]);
  };

  const handleRemove = (tag: string) => {
    persistTags(currentTags.filter(t => t !== tag));
  };

  return (
    <div data-testid="dataset-tags-editor" className="flex flex-wrap items-center gap-2 px-4 py-2">
      {currentTags.map(tag => (
        <Badge key={tag} size="md" className="gap-1 pr-1">
          {tag}
          <button
            type="button"
            aria-label={`Remove tag ${tag}`}
            disabled={updateDataset.isPending}
            onClick={() => handleRemove(tag)}
            className="text-neutral3 hover:text-neutral6 rounded-sm disabled:opacity-50"
          >
            <X className="size-3" />
          </button>
        </Badge>
      ))}
      <Combobox
        options={options}
        value={undefined}
        onValueChange={handleAdd}
        onInputValueChange={setSearch}
        placeholder={
          <span className="flex items-center gap-1.5">
            <Tag className="size-3.5" />
            Add tag
          </span>
        }
        searchPlaceholder="Search or create tag..."
        emptyText="Type to create a tag"
        variant="ghost"
        size="xs"
        className="w-auto min-w-0"
        disabled={updateDataset.isPending}
      />
    </div>
  );
}
