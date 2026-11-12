// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
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

describe('SearchInput controlled and debounced', () => {
  function UrlSearch({ initial }: { initial: string }) {
    const [value, setValue] = useState(initial);
    return (
      <>
        <SearchInput label="Search agents" value={value} onValueChange={setValue} debounceMs={300} />
        <button type="button" onClick={() => setValue('from url')}>
          Navigate
        </button>
        <output>{value}</output>
      </>
    );
  }

  it('shows what is typed, then reports it after the pause', () => {
    vi.useFakeTimers();
    render(<UrlSearch initial="" />);
    const input = screen.getByRole<HTMLInputElement>('searchbox', { name: 'Search agents' });

    fireEvent.change(input, { target: { value: 'chef' } });
    expect(input.value).toBe('chef');
    expect(screen.getByRole('status').textContent).toBe('');

    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByRole('status').textContent).toBe('chef');
    expect(input.value).toBe('chef');
    vi.useRealTimers();
  });

  it('drops a pending search when the parent resets the value', () => {
    vi.useFakeTimers();
    function Resettable() {
      const [value, setValue] = useState('foo');
      return (
        <>
          <SearchInput label="Search agents" value={value} onValueChange={setValue} debounceMs={300} />
          <button type="button" onClick={() => setValue('')}>
            Reset
          </button>
          <output>{value}</output>
        </>
      );
    }
    render(<Resettable />);
    const input = screen.getByRole<HTMLInputElement>('searchbox', { name: 'Search agents' });

    fireEvent.change(input, { target: { value: 'foob' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    act(() => vi.advanceTimersByTime(300));

    expect(input.value).toBe('');
    expect(screen.getByRole('status').textContent).toBe('');
    vi.useRealTimers();
  });

  it('shows an empty field after a search is applied and then reset', () => {
    vi.useFakeTimers();
    function Resettable() {
      const [value, setValue] = useState('');
      return (
        <>
          <SearchInput label="Search agents" value={value} onValueChange={setValue} debounceMs={300} />
          <button type="button" onClick={() => setValue('')}>
            Reset
          </button>
          <output>{value}</output>
        </>
      );
    }
    render(<Resettable />);
    const input = screen.getByRole<HTMLInputElement>('searchbox', { name: 'Search agents' });

    fireEvent.change(input, { target: { value: 'chef' } });
    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByRole('status').textContent).toBe('chef');
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

    expect(input.value).toBe('');
    vi.useRealTimers();
  });

  it('does not bring back a cancelled draft when the value returns', () => {
    vi.useFakeTimers();
    function Navigable() {
      const [value, setValue] = useState('');
      return (
        <>
          <SearchInput label="Search agents" value={value} onValueChange={setValue} debounceMs={300} />
          <button type="button" onClick={() => setValue('nav')}>
            Navigate
          </button>
          <button type="button" onClick={() => setValue('')}>
            Back
          </button>
        </>
      );
    }
    render(<Navigable />);
    const input = screen.getByRole<HTMLInputElement>('searchbox', { name: 'Search agents' });

    fireEvent.change(input, { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Navigate' }));
    expect(input.value).toBe('nav');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    act(() => vi.advanceTimersByTime(300));

    expect(input.value).toBe('');
    vi.useRealTimers();
  });

  it('follows a change the parent makes, such as a URL change', () => {
    render(<UrlSearch initial="chef" />);
    const input = screen.getByRole<HTMLInputElement>('searchbox', { name: 'Search agents' });

    fireEvent.click(screen.getByRole('button', { name: 'Navigate' }));

    expect(input.value).toBe('from url');
  });
});

describe('SearchInput that cannot be edited', () => {
  it.each(['disabled', 'readOnly'] as const)('offers no clear button when %s', prop => {
    render(<SearchInput label="Search agents" defaultValue="chef" onValueChange={vi.fn()} {...{ [prop]: true }} />);

    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();
  });
});
