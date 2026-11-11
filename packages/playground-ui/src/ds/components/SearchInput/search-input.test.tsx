// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SearchInput } from './search-input';
import type { SearchInputProps } from './search-input';

function ControlledSearch({ onClose }: { onClose?: () => void }) {
  const [value, setValue] = useState('');
  return <SearchInput label="Search code" value={value} onValueChange={setValue} onClose={onClose} />;
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

// A list page's search: it keeps its own text and reports it debounced.
const renderListSearch = (props: Partial<SearchInputProps> = {}) =>
  render(<SearchInput label="Search agents" onValueChange={vi.fn()} debounceMs={300} shortcut {...props} />);

describe('SearchInput keyboard shortcut', () => {
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
    renderListSearch({ defaultValue: 'agent' });

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
        <SearchInput label="Search agents" onValueChange={vi.fn()} shortcut />
        <SearchInput label="Search skills" onValueChange={vi.fn()} />
      </>,
    );

    fireEvent.keyDown(window, { key: 'f', metaKey: true, shiftKey: true });

    expect(document.activeElement).toBe(screen.getByRole('searchbox', { name: 'Search agents' }));
    expect(document.activeElement).not.toBe(screen.getByRole('searchbox', { name: 'Search skills' }));
  });

  it('still debounces search input', async () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    renderListSearch({ onValueChange: onSearch });

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search agents' }), { target: { value: 'abc' } });
    expect(onSearch).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(onSearch).toHaveBeenCalledWith('abc');
    vi.useRealTimers();
  });
});

describe('SearchInput debounced clearing', () => {
  it('offers no clear button until there is something to clear', () => {
    renderListSearch();

    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();
  });

  it('clears the field at once, drops the pending search and keeps focus in the field', () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    renderListSearch({ onValueChange: onSearch });
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

describe('SearchInput clearing', () => {
  it('clears the field and keeps focus in it', () => {
    render(<ControlledSearch />);
    const input = screen.getByRole<HTMLInputElement>('searchbox', { name: 'Search code' });

    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();
    fireEvent.change(input, { target: { value: 'span' } });
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(input.value).toBe('');
    expect(document.activeElement).toBe(input);
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();
  });
});

describe('SearchInput that collapses', () => {
  it('can be closed while empty', () => {
    const onClose = vi.fn();
    render(<ControlledSearch onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Close search' }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('clears what was typed when closed', () => {
    render(<ControlledSearch onClose={() => {}} />);
    const input = screen.getByRole<HTMLInputElement>('searchbox', { name: 'Search code' });

    fireEvent.change(input, { target: { value: 'span' } });
    fireEvent.click(screen.getByRole('button', { name: 'Close search' }));

    expect(input.value).toBe('');
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();
  });
});
