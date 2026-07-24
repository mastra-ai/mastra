import { Checkbox } from '@mastra/playground-ui/components/Checkbox';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@mastra/playground-ui/components/InputGroup';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { SearchIcon } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { useAgentColor } from '../../../contexts/agent-color-context';

export interface FilterableListItem {
  id: string;
  label: string;
  icon?: ReactNode;
}

interface FilterableListProps {
  title: string;
  items: FilterableListItem[];
  isChecked: (id: string) => boolean;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  disabled?: boolean;
  testIdPrefix: string;
}

/**
 * Left-pane filter list shared by the Models and Tools sections. Renders a
 * searchable, checkable list of entities (model providers / tool toolkits)
 * with Select all / Clear all bulk controls. Checked rows use the agent
 * accent color, matching the rest of the agent-builder picker UI.
 */
export const FilterableList = ({
  title,
  items,
  isChecked,
  onToggle,
  onSelectAll,
  onClearAll,
  disabled = false,
  testIdPrefix,
}: FilterableListProps) => {
  const agentColor = useAgentColor();
  const [search, setSearch] = useState('');

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter(item => item.label.toLowerCase().includes(term));
  }, [items, search]);

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-3 border-r border-border1 py-6 px-6"
      data-testid={`${testIdPrefix}-filter`}
    >
      <div className="shrink-0 rounded-full bg-surface3" data-testid={`${testIdPrefix}-filter-search`}>
        <InputGroup variant="outline" size="lg">
          <InputGroupAddon align="inline-start">
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            aria-label={`Filter ${title.toLowerCase()}`}
            placeholder={`Filter ${title.toLowerCase()}...`}
            onChange={event => setSearch(event.target.value)}
          />
        </InputGroup>
      </div>

      <div className="flex shrink-0 items-center gap-2 text-ui-xs">
        <button
          type="button"
          onClick={onSelectAll}
          disabled={disabled}
          data-testid={`${testIdPrefix}-filter-select-all`}
          className="text-neutral3 transition-colors hover:text-neutral6 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Select all
        </button>
        <span className="text-neutral2" aria-hidden>
          ·
        </span>
        <button
          type="button"
          onClick={onClearAll}
          disabled={disabled}
          data-testid={`${testIdPrefix}-filter-clear-all`}
          className="text-neutral3 transition-colors hover:text-neutral6 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Clear all
        </button>
      </div>

      <ScrollArea className="min-h-0 flex-1" viewPortClassName="pr-2">
        {filteredItems.length === 0 ? (
          <Txt variant="ui-xs" className="px-1 py-2 text-neutral3">
            No matches
          </Txt>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {filteredItems.map(item => {
              const checked = isChecked(item.id);
              const checkboxStyle: CSSProperties | undefined = checked
                ? {
                    backgroundColor: agentColor.background,
                    borderColor: agentColor.background,
                    color: agentColor.foreground,
                  }
                : undefined;

              return (
                <li key={item.id}>
                  <label
                    data-testid={`${testIdPrefix}-filter-item-${item.id}`}
                    data-checked={checked ? 'true' : 'false'}
                    className={cn(
                      'flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-ui-sm text-neutral6 transition-colors hover:bg-surface4',
                      disabled && 'cursor-not-allowed opacity-60',
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={disabled}
                      onCheckedChange={() => onToggle(item.id)}
                      style={checkboxStyle}
                      data-testid={`${testIdPrefix}-filter-checkbox-${item.id}`}
                      className="h-3.5 w-3.5 shrink-0 shadow-none [&_svg]:h-2.5 [&_svg]:w-2.5 data-[state=checked]:shadow-none"
                    />
                    {item.icon && <span className="flex shrink-0 items-center">{item.icon}</span>}
                    <span className="truncate">{item.label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
};
