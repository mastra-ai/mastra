import { Checkbox } from '@mastra/playground-ui/components/Checkbox';
import { Field, FieldLabel } from '@mastra/playground-ui/components/Field';
import { ScrollArea, ScrollAreaViewport } from '@mastra/playground-ui/components/ScrollArea';
import { SearchInput } from '@mastra/playground-ui/components/SearchInput';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { controlStateColorTransition } from '@mastra/playground-ui/primitives/transitions';
import { quietTextHover } from '@mastra/playground-ui/primitives/typography';
import { cn } from '@mastra/playground-ui/utils/cn';
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
      className="flex h-full min-h-0 flex-col gap-3 border-r border-border px-4 py-4"
      data-testid={`${testIdPrefix}-filter`}
    >
      <SearchInput
        label={`Filter ${title.toLowerCase()}`}
        size="md"
        className="flex-none"
        data-testid={`${testIdPrefix}-filter-search`}
        placeholder={`Filter ${title.toLowerCase()}...`}
        value={search}
        onValueChange={setSearch}
      />

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onSelectAll}
          disabled={disabled}
          data-testid={`${testIdPrefix}-filter-select-all`}
          className={cn(quietTextHover, controlStateColorTransition, 'disabled:cursor-not-allowed disabled:opacity-60')}
        >
          <Txt as="span" variant="meta" className="block">
            Select all
          </Txt>
        </button>
        <Txt as="span" variant="meta" tone="faint" aria-hidden>
          ·
        </Txt>
        <button
          type="button"
          onClick={onClearAll}
          disabled={disabled}
          data-testid={`${testIdPrefix}-filter-clear-all`}
          className={cn(quietTextHover, controlStateColorTransition, 'disabled:cursor-not-allowed disabled:opacity-60')}
        >
          <Txt as="span" variant="meta" className="block">
            Clear all
          </Txt>
        </button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <ScrollAreaViewport className="pr-2">
          {filteredItems.length === 0 ? (
            <Txt variant="meta" tone="muted" className="px-1 py-2">
              No matches
            </Txt>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {filteredItems.map(item => {
                const checked = isChecked(item.id);
                const checkboxStyle: CSSProperties | undefined = checked
                  ? {
                      backgroundColor: agentColor.tint,
                      borderColor: agentColor.tint,
                      color: 'var(--background)',
                    }
                  : undefined;

                return (
                  <li key={item.id}>
                    <Field disabled={disabled}>
                      <FieldLabel
                        textVariant="caption"
                        data-testid={`${testIdPrefix}-filter-item-${item.id}`}
                        data-checked={checked ? 'true' : 'false'}
                        className={cn(
                          'flex shrink items-center gap-2 rounded-md px-2 py-1.5 select-none hover:bg-fill-subtle',
                          disabled && 'opacity-60',
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => onToggle(item.id)}
                          style={checkboxStyle}
                          data-testid={`${testIdPrefix}-filter-checkbox-${item.id}`}
                          className="h-3.5 w-3.5 shrink-0 shadow-none data-[state=checked]:shadow-none [&_svg]:h-2.5 [&_svg]:w-2.5"
                        />
                        {item.icon && <span className="flex shrink-0 items-center">{item.icon}</span>}
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      </FieldLabel>
                    </Field>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollAreaViewport>
      </ScrollArea>
    </div>
  );
};
