import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { BoardFilterOptions } from './board-filter-options';
import type { BoardFilterOptionsProps } from './board-filter-options';
import { DropdownMenu } from '@/ds/components/DropdownMenu';

import { IconMagnifyingGlass } from '@/ds/icons/central/IconMagnifyingGlass';
import { menuEmptyClass, menuSearchClasses } from '@/ds/primitives/menu-item';
import { passwordManagerOptOutProps } from '@/ds/primitives/password-manager-autofill';

export function SearchableBoardFilterContent({
  label,
  options,
  selected,
  onChange,
}: BoardFilterOptionsProps & { label: string }) {
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
          <IconMagnifyingGlass className={menuSearchClasses.icon} aria-hidden />
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search"
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
        <BoardFilterOptions options={ordered} selected={selected} onChange={onChange} />
      )}
    </DropdownMenu.SubContent>
  );
}
