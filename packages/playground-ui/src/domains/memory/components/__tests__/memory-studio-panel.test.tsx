// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MemoryStudioPanel } from '../memory-studio-panel';
import { memoryMessages, omHistoryRecords } from './fixtures/memory-studio';

afterEach(() => {
  cleanup();
});

describe('MemoryStudioPanel', () => {
  it('renders observation detail, context progress, and the flame graph from props', () => {
    render(<MemoryStudioPanel messages={memoryMessages} omRecords={omHistoryRecords} />);

    // ObservationDetailView renders its "History" header when records are present.
    expect(screen.getByText('History')).toBeTruthy();
    // ThreadContextProgress renders Messages + Memory bars from the derived window state.
    expect(screen.getAllByText('Messages').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Memory').length).toBeGreaterThan(0);
    // FlameGraph renders its zoom controls.
    expect(screen.getByLabelText('Reset zoom')).toBeTruthy();
  });

  it('renders a loading state via the single combined flag', () => {
    render(<MemoryStudioPanel messages={[]} omRecords={[]} isLoading />);
    expect(screen.getByTestId('memory-studio-loading')).toBeTruthy();
  });

  it('calls onClose when the close icon button is clicked', () => {
    const onClose = vi.fn();
    render(<MemoryStudioPanel messages={memoryMessages} omRecords={omHistoryRecords} onClose={onClose} />);

    const closeButton = screen.getByRole('button', { name: 'Close memory panel' });
    expect(closeButton).toBeTruthy();

    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('selects the observation at or before the replay cursor', () => {
    const cursor = new Date('2026-06-01T10:03:00.000Z').getTime();
    render(<MemoryStudioPanel messages={memoryMessages} omRecords={omHistoryRecords} selectedTimestamp={cursor} />);

    // Cursor at 10:03 → om-1 (10:01, 320 tokens), not om-2 (10:05, 640 tokens).
    // The main detail header shows the selected record's token count.
    expect(screen.getByText('320 tokens')).toBeTruthy();
    expect(screen.queryByText('640 tokens')).toBeNull();
  });

  it('defaults to the latest observation when no replay cursor is set', () => {
    render(<MemoryStudioPanel messages={memoryMessages} omRecords={omHistoryRecords} />);

    // Latest record om-2 → 640 tokens.
    expect(screen.getByText('640 tokens')).toBeTruthy();
  });
});
