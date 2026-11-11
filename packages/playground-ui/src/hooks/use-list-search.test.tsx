// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SearchIcon, XIcon } from 'lucide-react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useListSearch } from './use-list-search';
import type { UseListSearchOptions } from './use-list-search';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/ds/components/InputGroup';

// A list page's search field, composed the way pages compose it.
function ListSearchField({ label, ...options }: UseListSearchOptions & { label: string }) {
  const search = useListSearch(options);
  return (
    <InputGroup size="sm">
      <InputGroupAddon>
        <SearchIcon />
      </InputGroupAddon>
      <InputGroupInput {...search.inputProps} aria-label={label} placeholder="Search by name" />
      {search.value && (
        <InputGroupAddon align="inline-end">
          <InputGroupButton aria-label="Clear search" onClick={search.clear}>
            <XIcon />
          </InputGroupButton>
        </InputGroupAddon>
      )}
    </InputGroup>
  );
}

const setPlatform = (value: string) => {
  Object.defineProperty(navigator, 'platform', { value, configurable: true });
};

const originalPlatform = navigator.platform;

beforeEach(() => {
  setPlatform(originalPlatform);
});

afterEach(() => {
  cleanup();
  setPlatform(originalPlatform);
});

const renderListSearch = (props: Partial<React.ComponentProps<typeof ListSearchField>> = {}) =>
  render(<ListSearchField onSearch={vi.fn()} label="Search agents" {...props} />);

describe('useListSearch keyboard shortcut', () => {
  it('focuses the search field on Cmd+Shift+F on mac', () => {
    setPlatform('MacIntel');
    renderListSearch();

    fireEvent.keyDown(window, { key: 'f', metaKey: true, shiftKey: true });

    expect(document.activeElement).toBe(screen.getByRole('searchbox', { name: 'Search agents' }));
  });

  it('focuses the search field on Ctrl+Shift+F off mac', () => {
    setPlatform('Win32');
    renderListSearch();

    fireEvent.keyDown(window, { key: 'f', ctrlKey: true, shiftKey: true });

    expect(document.activeElement).toBe(screen.getByRole('searchbox', { name: 'Search agents' }));
  });

  it('ignores Cmd+F without shift so the browser find bar keeps working', () => {
    setPlatform('MacIntel');
    renderListSearch();

    fireEvent.keyDown(window, { key: 'f', metaKey: true });

    expect(document.activeElement).not.toBe(screen.getByRole('searchbox', { name: 'Search agents' }));
  });

  it('selects the existing value so the next keystroke replaces it', () => {
    setPlatform('MacIntel');
    renderListSearch({ value: 'agent' });

    fireEvent.keyDown(window, { key: 'f', metaKey: true, shiftKey: true });

    const input = screen.getByRole<HTMLInputElement>('searchbox', { name: 'Search agents' });
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe('agent'.length);
  });

  it('does not react to the shortcut when it is disabled', () => {
    setPlatform('MacIntel');
    renderListSearch({ shortcut: false });

    fireEvent.keyDown(window, { key: 'f', metaKey: true, shiftKey: true });

    expect(document.activeElement).not.toBe(screen.getByRole('searchbox', { name: 'Search agents' }));
  });

  it('leaves the disabled instance alone when two are mounted', () => {
    setPlatform('MacIntel');
    render(
      <>
        <ListSearchField onSearch={vi.fn()} label="Search agents" />
        <ListSearchField onSearch={vi.fn()} label="Search skills" shortcut={false} />
      </>,
    );

    fireEvent.keyDown(window, { key: 'f', metaKey: true, shiftKey: true });

    expect(document.activeElement).toBe(screen.getByRole('searchbox', { name: 'Search agents' }));
    expect(document.activeElement).not.toBe(screen.getByRole('searchbox', { name: 'Search skills' }));
  });

  it('still debounces search input', async () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    renderListSearch({ onSearch });

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search agents' }), { target: { value: 'abc' } });
    expect(onSearch).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(onSearch).toHaveBeenCalledWith('abc');
    vi.useRealTimers();
  });
});

describe('useListSearch clearing', () => {
  it('offers no clear button until there is something to clear', () => {
    renderListSearch();

    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();
  });

  it('clears the field at once, drops the pending search and keeps focus in the field', () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    renderListSearch({ onSearch });
    const input = screen.getByRole<HTMLInputElement>('searchbox', { name: 'Search agents' });

    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    vi.advanceTimersByTime(300);

    expect(input.value).toBe('');
    expect(onSearch.mock.calls).toEqual([['']]);
    expect(document.activeElement).toBe(input);
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();
    vi.useRealTimers();
  });
});
