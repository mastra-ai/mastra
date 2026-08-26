import { Checkbox } from '@mastra/playground-ui/components/Checkbox';
import { ListSearch } from '@mastra/playground-ui/components/ListSearch';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Fragment, useState } from 'react';

export interface SourcePickerItem {
  id: string;
  label: string;
}

export interface SourcePickerGroup {
  id: string;
  /** Rendered as a heading above the group; omitted for a single flat list. */
  label?: string;
  items: SourcePickerItem[];
}

/**
 * Searchable checkbox list of the items one source can feed Intake with.
 * Groups (Linear teams) only add a heading — the search spans every group so a
 * project can be found without knowing which team owns it.
 */
export function SourcePicker({
  label,
  groups,
  selectedIds,
  disabled,
  pending,
  onToggleItem,
}: {
  /** Names the list for assistive tech and the search field, e.g. "Repositories". */
  label: string;
  groups: SourcePickerGroup[];
  selectedIds: string[] | null;
  disabled: boolean;
  /** True while the selection save is in flight — shows the spinner. */
  pending: boolean;
  onToggleItem: (id: string) => void;
}) {
  const [query, setQuery] = useState('');

  const normalizedQuery = query.trim().toLowerCase();
  const matchingGroups = groups
    .map(group => ({
      ...group,
      items: group.items.filter(item => item.label.toLowerCase().includes(normalizedQuery)),
    }))
    .filter(group => group.items.length > 0);
  // A shared Linear project appears under every team it belongs to, so count ids, not rows.
  const selectedCount = new Set(
    groups
      .flatMap(group => group.items)
      .filter(item => selectedIds?.includes(item.id))
      .map(item => item.id),
  ).size;

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-2">
        <div className="min-w-0 flex-1">
          <ListSearch label={`Search ${label}`} placeholder="Search…" size="sm" value={query} onSearch={setQuery} />
        </div>
        {pending ? (
          <Spinner size="sm" aria-label={`Saving ${label} selection`} />
        ) : (
          selectedCount > 0 && (
            <Txt as="span" variant="ui-xs" className="text-icon3 shrink-0">
              {selectedCount} selected
            </Txt>
          )
        )}
      </div>

      <ScrollArea orientation="vertical" maxHeight="20rem">
        <div role="group" aria-label={label} className="flex flex-col gap-px p-2">
          {matchingGroups.length === 0 ? (
            <Txt as="p" variant="ui-sm" className="text-icon3 px-2 py-2">
              No matches
            </Txt>
          ) : (
            matchingGroups.map(group => (
              <Fragment key={group.id}>
                {group.label && (
                  <Txt as="p" variant="ui-xs" className="text-icon3 px-2 pt-3 pb-1 first:pt-0">
                    {group.label}
                  </Txt>
                )}
                {group.items.map(item => (
                  <label
                    key={`${group.id}:${item.id}`}
                    className="hover:bg-surface-overlay-soft flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 has-data-[disabled]:cursor-not-allowed"
                  >
                    <Checkbox
                      checked={selectedIds?.includes(item.id) ?? false}
                      disabled={disabled}
                      onCheckedChange={() => onToggleItem(item.id)}
                    />
                    <Txt as="span" variant="ui-md" className="text-icon5 truncate">
                      {item.label}
                    </Txt>
                  </label>
                ))}
              </Fragment>
            ))
          )}
        </div>
      </ScrollArea>
    </>
  );
}
