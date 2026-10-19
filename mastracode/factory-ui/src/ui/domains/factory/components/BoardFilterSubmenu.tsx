import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { menuEmptyClass, menuSearchClasses } from '@mastra/playground-ui/primitives/menu-item';
import { passwordManagerOptOutProps } from '@mastra/playground-ui/primitives/password-manager-autofill';
import { SearchIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

import { boardFilterOptions, boardFilterSummary } from './boardFilterFields';
import type { BoardFilterField, BoardFilterOption } from './boardFilterFields';

/** Past this many options the list scrolls, so it gets a search box and keeps its picks on top. */
const SEARCHABLE_OPTION_COUNT = 8;
const MENU_NAVIGATION_KEYS = ['ArrowUp', 'ArrowDown', 'Escape', 'Tab'];

interface OptionListProps {
  options: readonly BoardFilterOption[];
  selected: readonly string[];
  onChange: (values: string[]) => void;
}

function OptionItems({ options, selected, onChange }: OptionListProps) {
  const picked = new Set(selected);
  return options.map(option => (
    <DropdownMenu.CheckboxItem
      key={option.value}
      checked={picked.has(option.value)}
      onCheckedChange={checked =>
        onChange(checked ? [...selected, option.value] : selected.filter(value => value !== option.value))
      }
    >
      {option.start}
      <span>{option.label ?? option.value}</span>
    </DropdownMenu.CheckboxItem>
  ));
}

/** Mounts with each open, so the query clears and the picks pinned on top stay put while you tick. */
function SearchableOptionItems({ label, options, selected, onChange }: OptionListProps & { label: string }) {
  const [query, setQuery] = useState('');
  const [pickedOnOpen] = useState(() => new Set(selected));
  const searchRef = useRef<HTMLInputElement>(null);
  const needle = query.trim().toLowerCase();
  const matching = options.filter(option =>
    [option.label ?? option.value, option.alsoMatches].some(text => text?.toLowerCase().includes(needle)),
  );
  const ordered = [
    ...matching.filter(option => pickedOnOpen.has(option.value)),
    ...matching.filter(option => !pickedOnOpen.has(option.value)),
  ];

  // The menu's typeahead swallows printable keys, and opening from the keyboard focuses the first
  // option rather than the box: typing anywhere in the list goes to the search, Space still ticks.
  const keepTypingInSearch = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target === searchRef.current) {
      if (event.key === 'Escape' || event.key === 'Tab') return;
      event.stopPropagation();
      if (event.key !== 'ArrowDown') return;
      event.preventDefault();
      event.currentTarget.querySelector<HTMLElement>('[role=menuitemcheckbox]')?.focus();
      return;
    }
    const typed = event.key.length === 1 && event.key !== ' ' && !event.metaKey && !event.ctrlKey && !event.altKey;
    if (!typed) return;
    event.stopPropagation();
    searchRef.current?.focus();
  };

  return (
    <div className="contents" onKeyDownCapture={keepTypingInSearch}>
      <div className={`${menuSearchClasses.container} bg-card sticky -top-1 z-10`}>
        <SearchIcon className={menuSearchClasses.icon} aria-hidden />
        <input
          ref={searchRef}
          type="text"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Search…"
          aria-label={`Search ${label.toLowerCase()}`}
          className={menuSearchClasses.input}
          autoFocus
          {...passwordManagerOptOutProps}
        />
      </div>
      {ordered.length === 0 ? (
        <div className={menuEmptyClass}>No matches</div>
      ) : (
        <OptionItems options={ordered} selected={selected} onChange={onChange} />
      )}
    </div>
  );
}

export function BoardFilterSubmenu({
  field,
  selected,
  onChange,
}: {
  field: BoardFilterField;
  selected: readonly string[];
  onChange: (values: string[]) => void;
}) {
  const options = boardFilterOptions(field, selected);
  if (options.length === 0) return null;
  const Icon = field.icon;

  return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger hint={selected.length > 0 ? boardFilterSummary(field, selected) : undefined}>
        {Icon && <Icon aria-hidden />}
        <span>{field.label}</span>
      </DropdownMenu.SubTrigger>
      <DropdownMenu.SubContent>
        {options.length > SEARCHABLE_OPTION_COUNT ? (
          <SearchableOptionItems label={field.label} options={options} selected={selected} onChange={onChange} />
        ) : (
          <OptionItems options={options} selected={selected} onChange={onChange} />
        )}
      </DropdownMenu.SubContent>
    </DropdownMenu.Sub>
  );
}
