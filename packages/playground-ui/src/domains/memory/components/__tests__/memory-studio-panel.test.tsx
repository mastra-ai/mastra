// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MemoryStudioPanel } from '../memory-studio-panel';
import { memoryMessages, omHistoryRecords } from './fixtures/memory-studio';

afterEach(() => {
  cleanup();
});

describe('MemoryStudioPanel', () => {
  it('renders observation detail, context progress, and the flame graph from props', () => {
    render(<MemoryStudioPanel messages={memoryMessages} omRecords={omHistoryRecords} />);

    // Header renders the "Observational memory" title.
    expect(screen.getByText('Observational memory')).toBeTruthy();
    // ObservationDetailView renders its "History" header when records are present.
    expect(screen.getByText('History')).toBeTruthy();
    // ThreadContextProgress renders only the Messages bar; the Memory bar was
    // removed. Scope by the uppercase bar-label class because a separate
    // ObservationDetailView "Memory" label still exists in the panel.
    const barLabels = Array.from(document.querySelectorAll('span.uppercase.tracking-wide')).map(el => el.textContent);
    expect(barLabels).toContain('Messages');
    expect(barLabels).not.toContain('Memory');
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

    // Cursor at 10:03 → om-1 (10:01), not om-2 (10:05). The main detail body
    // shows the selected record's active observations text (the history list
    // still contains every record, so scope the assertion to the body).
    const body = screen.getByTestId('observation-detail-body');
    expect(within(body).getByText(/User asked about onboarding/)).toBeTruthy();
    expect(within(body).queryByText(/User reported a blocking bug/)).toBeNull();
  });

  it('defaults to the latest observation when no replay cursor is set', () => {
    render(<MemoryStudioPanel messages={memoryMessages} omRecords={omHistoryRecords} />);

    // Latest record om-2 → its active observations text is shown in the body.
    const body = screen.getByTestId('observation-detail-body');
    expect(within(body).getByText(/User reported a blocking bug/)).toBeTruthy();
  });

  it('prefers explicit contextWindow values over the marker-derived window state', () => {
    render(
      <MemoryStudioPanel
        messages={memoryMessages}
        omRecords={omHistoryRecords}
        contextWindow={{
          messageTokens: 14200,
          messageThreshold: 30000,
          memoryTokens: 4500,
          memoryThreshold: 6000,
        }}
      />,
    );

    // ThreadContextProgress renders the Messages bar from the explicit value: 14.2/30k.
    expect(screen.getByText('14.2/30k')).toBeTruthy();
    // The memory token count is lifted into the header beside the title: 4.5/6k.
    expect(screen.getByText('4.5/6k')).toBeTruthy();
    // The marker-derived readout (messages 540/2000 → 0.5/2k) must not appear.
    expect(screen.queryByText('0.5/2k')).toBeNull();
  });

  it('falls back to the marker-derived window state when no contextWindow is supplied', () => {
    render(<MemoryStudioPanel messages={memoryMessages} omRecords={omHistoryRecords} />);

    // Marker-derived active window: messages 540/2000 → 0.5/2k (Messages bar)
    // and memory 320/1000 → 0.3/1k (lifted into the header beside the title).
    expect(screen.getByText('0.5/2k')).toBeTruthy();
    expect(screen.getByText('0.3/1k')).toBeTruthy();
    expect(screen.queryByText('14.2/30k')).toBeNull();
  });
});
