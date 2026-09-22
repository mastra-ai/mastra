// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ListSearch } from './list-search';

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

const renderListSearch = (props: Partial<React.ComponentProps<typeof ListSearch>> = {}) =>
  render(<ListSearch onSearch={vi.fn()} label="Filter agents" placeholder="Filter by name" {...props} />);

describe('ListSearch keyboard shortcut', () => {
  it('focuses the search field on Cmd+Shift+F on mac', () => {
    setPlatform('MacIntel');
    renderListSearch();

    fireEvent.keyDown(window, { key: 'f', metaKey: true, shiftKey: true });

    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Filter agents' }));
  });

  it('focuses the search field on Ctrl+Shift+F off mac', () => {
    setPlatform('Win32');
    renderListSearch();

    fireEvent.keyDown(window, { key: 'f', ctrlKey: true, shiftKey: true });

    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Filter agents' }));
  });

  it('ignores Cmd+F without shift so the browser find bar keeps working', () => {
    setPlatform('MacIntel');
    renderListSearch();

    fireEvent.keyDown(window, { key: 'f', metaKey: true });

    expect(document.activeElement).not.toBe(screen.getByRole('textbox', { name: 'Filter agents' }));
  });

  it('selects the existing value so the next keystroke replaces it', () => {
    setPlatform('MacIntel');
    renderListSearch({ value: 'agent' });

    fireEvent.keyDown(window, { key: 'f', metaKey: true, shiftKey: true });

    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Filter agents' });
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe('agent'.length);
  });

  it('does not react to the shortcut when it is disabled', () => {
    setPlatform('MacIntel');
    renderListSearch({ shortcutDisabled: true });

    fireEvent.keyDown(window, { key: 'f', metaKey: true, shiftKey: true });

    expect(document.activeElement).not.toBe(screen.getByRole('textbox', { name: 'Filter agents' }));
  });

  it('leaves the disabled instance alone when two are mounted', () => {
    setPlatform('MacIntel');
    render(
      <>
        <ListSearch onSearch={vi.fn()} label="Filter agents" placeholder="Filter by name" />
        <ListSearch onSearch={vi.fn()} label="Filter skills" placeholder="Filter by name" shortcutDisabled />
      </>,
    );

    fireEvent.keyDown(window, { key: 'f', metaKey: true, shiftKey: true });

    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Filter agents' }));
    expect(document.activeElement).not.toBe(screen.getByRole('textbox', { name: 'Filter skills' }));
  });

  it('still debounces search input', async () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    renderListSearch({ onSearch });

    fireEvent.change(screen.getByRole('textbox', { name: 'Filter agents' }), { target: { value: 'abc' } });
    expect(onSearch).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(onSearch).toHaveBeenCalledWith('abc');
    vi.useRealTimers();
  });
});
