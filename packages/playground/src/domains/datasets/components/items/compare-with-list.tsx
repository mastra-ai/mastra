'use client';

import { SearchFieldBlock } from '@mastra/playground-ui/components/FormFieldBlocks';
import { GitCompareIcon } from 'lucide-react';
import { useState } from 'react';
import { useDebounce } from 'use-debounce';
import { useDatasetItems } from '../../hooks/use-dataset-items';
import { useLinkComponent } from '@/lib/framework';

export interface CompareWithListProps {
  datasetId: string;
  currentItemId: string;
}

/**
 * "Compare with" section shown at the bottom of the item detail side panel.
 * Lists the dataset's other items (searchable); clicking a row opens the
 * compare page with the current item on the left.
 */
export function CompareWithList({ datasetId, currentItemId }: CompareWithListProps) {
  const { Link, paths } = useLinkComponent();
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebounce(search, 300);

  const { data: items, isLoading } = useDatasetItems(datasetId, debouncedSearch || undefined);
  const otherItems = items.filter(i => i.id !== currentItemId);

  return (
    <section aria-label="Compare with" className="mt-4 grid gap-2">
      <h3 className="text-ui-md text-icon5 flex items-center gap-1.5 font-medium">
        <GitCompareIcon className="size-[1.1em]" /> Compare with
      </h3>
      <SearchFieldBlock
        name="compare-with-search"
        label="Search items to compare"
        labelIsHidden={true}
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search items..."
      />
      {isLoading ? (
        <p className="text-ui-sm text-icon3">Loading items…</p>
      ) : otherItems.length === 0 ? (
        <p className="text-ui-sm text-icon3">No other items to compare with.</p>
      ) : (
        <ul className="grid gap-1">
          {otherItems.map(other => (
            <li key={other.id}>
              <Link
                href={paths.datasetItemCompareLink(datasetId, currentItemId, other.id)}
                className="text-ui-md hover:bg-surface4 text-icon4 hover:text-icon6 flex items-center gap-2 rounded-md px-2 py-1.5"
              >
                <span className="truncate font-mono">{other.id}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
