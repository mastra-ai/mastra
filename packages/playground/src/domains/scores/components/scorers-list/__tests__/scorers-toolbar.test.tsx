// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ScorersToolbar } from '../scorers-toolbar';

// Mirrors the parent: reflects the committed search back into props, so we can prove the
// local input does NOT rewind when the parent echoes our own debounced commit.
function ControlledToolbar({ initial = '' }: { initial?: string }) {
  const [search, setSearch] = useState(initial);
  return <ScorersToolbar search={search} onSearchChange={setSearch} sourceFilter="" onSourceFilterChange={() => {}} />;
}

describe('ScorersToolbar', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    cleanup();
  });

  const setup = (overrides: Partial<ComponentProps<typeof ScorersToolbar>> = {}) => {
    const onSearchChange = vi.fn();
    const onSourceFilterChange = vi.fn();
    render(
      <ScorersToolbar
        search=""
        onSearchChange={onSearchChange}
        sourceFilter=""
        onSourceFilterChange={onSourceFilterChange}
        {...overrides}
      />,
    );
    return { onSearchChange, onSourceFilterChange };
  };

  it('debounces the search input by 300ms before committing upstream', () => {
    const { onSearchChange } = setup();
    const input = screen.getByLabelText('Search scorers');

    fireEvent.change(input, { target: { value: 'acc' } });
    expect(onSearchChange).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(299));
    expect(onSearchChange).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(onSearchChange).toHaveBeenCalledTimes(1);
    expect(onSearchChange).toHaveBeenCalledWith('acc');
  });

  it('clear button empties the field and commits an empty query immediately', () => {
    const { onSearchChange } = setup();
    const input = screen.getByLabelText('Search scorers') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'abc' } });
    expect(input.value).toBe('abc');

    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(input.value).toBe('');
    expect(onSearchChange).toHaveBeenLastCalledWith('');
  });

  it('mirrors an external search reset into the input', () => {
    const onSearchChange = vi.fn();
    const { rerender } = render(
      <ScorersToolbar
        search="preset"
        onSearchChange={onSearchChange}
        sourceFilter=""
        onSourceFilterChange={() => {}}
      />,
    );
    const input = screen.getByLabelText('Search scorers') as HTMLInputElement;
    expect(input.value).toBe('preset');

    rerender(
      <ScorersToolbar search="" onSearchChange={onSearchChange} sourceFilter="" onSourceFilterChange={() => {}} />,
    );
    expect(input.value).toBe('');
  });

  it('Reset clears an in-flight (typed-but-uncommitted) search and cancels the pending commit', () => {
    // Reset is visible from an active source filter alone (parent: hasActiveFilters =
    // sourceFilter !== 'all' || search !== ''), so the user can type then Reset before the
    // 300ms commit. The field must clear immediately AND the pending debounce must not later
    // resurrect the just-reset term.
    const onSearchChange = vi.fn();
    const onReset = vi.fn();
    render(
      <ScorersToolbar
        search=""
        onSearchChange={onSearchChange}
        sourceFilter="code"
        onSourceFilterChange={() => {}}
        onReset={onReset}
        hasActiveFilters
      />,
    );
    const input = screen.getByLabelText('Search scorers') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'abc' } });
    expect(input.value).toBe('abc');

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(input.value).toBe('');
    expect(onReset).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(300));
    expect(onSearchChange).not.toHaveBeenCalledWith('abc');
  });

  it('does not rewind the field when the parent echoes the committed value (no dropped keystroke)', () => {
    render(<ControlledToolbar />);
    const input = screen.getByLabelText('Search scorers') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'a' } });
    act(() => vi.advanceTimersByTime(300)); // commits 'a' -> parent search becomes 'a'

    // Keep typing before the next debounce fires; the parent prop still reads 'a'.
    fireEvent.change(input, { target: { value: 'ab' } });
    expect(input.value).toBe('ab'); // must NOT rewind to 'a'

    act(() => vi.advanceTimersByTime(300));
    expect(input.value).toBe('ab');
  });
});
