import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { menuEmptyClass, menuSearchClasses } from '@mastra/playground-ui/primitives/menu-item';
import { passwordManagerOptOutProps } from '@mastra/playground-ui/primitives/password-manager-autofill';
import { SearchIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

import { boardFilterOptions, boardFilterSummary } from './boardFilterFields';
import type { BoardFilterField, BoardFilterOption } from './boardFilterFields';

const SEARCHABLE_OPTION_COUNT = 8;

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

function SearchableOptionContent({ label, options, selected, onChange }: OptionListProps & { label: string }) {
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

  // Base UI menu typeahead eats printable keys and keyboard-open focuses the first option, not the box.
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
    <DropdownMenu.SubContent
      onKeyDownCapture={keepTypingInSearch}
      header={
        <div className={menuSearchClasses.header}>
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
      }
    >
      {ordered.length === 0 ? (
        <div className={menuEmptyClass}>No matches</div>
      ) : (
        <OptionItems options={ordered} selected={selected} onChange={onChange} />
      )}
    </DropdownMenu.SubContent>
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
      {options.length > SEARCHABLE_OPTION_COUNT ? (
        <SearchableOptionContent label={field.label} options={options} selected={selected} onChange={onChange} />
      ) : (
        <DropdownMenu.SubContent>
          <OptionItems options={options} selected={selected} onChange={onChange} />
        </DropdownMenu.SubContent>
      )}
    </DropdownMenu.Sub>
  );
}
