import type { StoredPromptBlockResponse } from '@mastra/client-js';
import { Button } from '@/ds/components/Button';
import { ItemList } from '@/ds/components/ItemList';
import { ItemListSkeleton } from '@/ds/components/ItemList/item-list-skeleton';
import { type ItemListColumn } from '@/ds/components/ItemList/types';
import { useMemo, useState } from 'react';
import { useLinkComponent } from '@/lib/framework';
import { ListSearch } from '@/ds/components/ListSearch';
import { Column } from '@/ds/components/Columns';
import { SelectFieldBlock } from '@/ds/components/FormFieldBlocks/fields/select-field-block';
import { Chip, useIsCmsAvailable } from '@/index';
import { XIcon } from 'lucide-react';
import { NoPromptBlocksInfo } from './no-prompt-blocks-info';

type StateFilter = 'all' | 'published' | 'draft';

const stateFilterOptions: { value: StateFilter; label: string }[] = [
  { value: 'all', label: 'Any status' },
  { value: 'published', label: 'Is published' },
  { value: 'draft', label: 'Has draft' },
];

const columns: ItemListColumn[] = [
  { name: 'name', label: 'Name & Description', size: '1fr' },
  { name: 'status', label: 'Status', size: '10rem' },
];

export interface PromptBlockListProps {
  promptBlocks: StoredPromptBlockResponse[];
  isLoading: boolean;
}

export function PromptBlockList({ promptBlocks, isLoading }: PromptBlockListProps) {
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState<StateFilter>('all');
  const { navigate, paths } = useLinkComponent();
  const hasActiveFilters = stateFilter !== 'all';

  const handleReset = () => {
    setStateFilter('all');
  };

  const filteredData = useMemo(() => {
    const term = search.toLowerCase();
    return promptBlocks.filter(b => {
      const matchesSearch = b.name?.toLowerCase().includes(term) || b.description?.toLowerCase().includes(term);
      if (!matchesSearch) return false;

      if (stateFilter === 'published') return !!b.activeVersionId;
      if (stateFilter === 'draft') return b.hasDraft || !b.activeVersionId;
      return true;
    });
  }, [promptBlocks, search, stateFilter]);

  if (promptBlocks.length === 0 && !isLoading) {
    return <NoPromptBlocksInfo />;
  }

  return (
    <Column>
      <Column.Toolbar>
        <ListSearch onSearch={setSearch} label="Filter prompts by name" placeholder="Filter by name or description" />
        <SelectFieldBlock
          name="filter-status"
          label="Filter by status"
          labelIsHidden
          value={stateFilter}
          options={stateFilterOptions}
          onValueChange={v => setStateFilter(v as StateFilter)}
        />
        {hasActiveFilters && (
          <Button onClick={handleReset}>
            <XIcon />
            Reset
          </Button>
        )}
      </Column.Toolbar>

      <Column.Content>
        {isLoading ? (
          <ItemListSkeleton columns={columns} />
        ) : (
          <ItemList>
            <ItemList.Items>
              {filteredData.map(block => (
                <ItemList.Row key={block.id}>
                  <ItemList.RowButton
                    columns={columns}
                    item={{ id: block.id }}
                    onClick={() => navigate(paths.cmsPromptBlockEditLink(block.id))}
                    className="min-h-16"
                  >
                    <ItemList.TextCell className="grid">
                      <span className="text-neutral4 text-ui-md truncate">{block.name}</span>
                      {block.description && (
                        <span className="text-neutral2 text-ui-md truncate">{block.description}</span>
                      )}
                    </ItemList.TextCell>
                    <ItemList.Cell className="flex items-center gap-1">
                      {block.activeVersionId && (
                        <Chip size="small" color="green">
                          Published
                        </Chip>
                      )}
                      {(block.hasDraft || !block.activeVersionId) && (
                        <Chip size="small" color="blue">
                          Draft
                        </Chip>
                      )}
                    </ItemList.Cell>
                  </ItemList.RowButton>
                </ItemList.Row>
              ))}
            </ItemList.Items>
          </ItemList>
        )}
      </Column.Content>
    </Column>
  );
}
