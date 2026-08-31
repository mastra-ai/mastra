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
    // ThreadContextProgress renders both the Messages and Observations bars to
    // match the collapsed sidebar. Scope by the uppercase bar-label class.
    const barLabels = Array.from(document.querySelectorAll('span.uppercase.tracking-wide')).map(el => el.textContent);
    expect(barLabels).toContain('Messages');
    expect(barLabels).toContain('Observations');
    // FlameGraph renders its zoom controls.
    expect(screen.getByLabelText('Reset zoom')).toBeTruthy();
  });

  it('renders a loading state via the single combined flag', () => {
    render(<MemoryStudioPanel messages={[]} omRecords={[]} isLoading />);
    expect(screen.getByTestId('memory-studio-loading')).toBeTruthy();
  });

  it('calls onClose when the Back button is clicked', () => {
    const onClose = vi.fn();
    render(<MemoryStudioPanel messages={memoryMessages} omRecords={omHistoryRecords} onClose={onClose} />);

    const backButton = screen.getByRole('button', { name: 'Back to memory' });
    expect(backButton).toBeTruthy();

    fireEvent.click(backButton);
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
    // The observation token count renders as the Observations bar: 4.5/6k.
    expect(screen.getByText('4.5/6k')).toBeTruthy();
    const barLabels = Array.from(document.querySelectorAll('span.uppercase.tracking-wide')).map(el => el.textContent);
    expect(barLabels).toContain('Messages');
    expect(barLabels).toContain('Observations');
    // The marker-derived readout (messages 540/2000 → 0.5/2k) must not appear.
    expect(screen.queryByText('0.5/2k')).toBeNull();
  });

  it('filters the observation list to the selected zoom range and restores it on reset', () => {
    // Domain is message-derived: [10:00, 10:05]. om-1 is at 10:01, om-2 at 10:05.
    render(<MemoryStudioPanel messages={memoryMessages} omRecords={omHistoryRecords} />);

    // Both records visible by default: the History list shows both entries and
    // the body defaults to the latest (om-2).
    const bodyBefore = screen.getByTestId('observation-detail-body');
    expect(within(bodyBefore).getByText(/User reported a blocking bug/)).toBeTruthy();
    expect(screen.getByText('History')).toBeTruthy();

    // Collapse the range by dragging the right zoom handle to ~40% of the track,
    // i.e. ~10:02, which keeps om-1 (10:01) and drops om-2 (10:05).
    const track = document.querySelector('.cursor-pointer.select-none') as HTMLElement;
    expect(track).toBeTruthy();
    track.getBoundingClientRect = () => ({ left: 0, width: 100, top: 0, height: 24 }) as DOMRect;
    // mousedown near the right edge selects the right handle, then drag it left.
    fireEvent.mouseDown(track, { clientX: 100 });
    fireEvent.mouseMove(window, { clientX: 40 });
    fireEvent.mouseUp(window);

    // Now only om-1 is in range: its text shows in the body and the out-of-range
    // om-2 observation is gone. With a single record the History list collapses.
    const bodyAfter = screen.getByTestId('observation-detail-body');
    expect(within(bodyAfter).getByText(/User asked about onboarding/)).toBeTruthy();
    expect(within(bodyAfter).queryByText(/User reported a blocking bug/)).toBeNull();
    expect(screen.queryByText('History')).toBeNull();

    // Reset zoom restores the full list: the History rail comes back (it only
    // renders with more than one record) and the previously out-of-range om-2
    // observation is selectable again from it.
    fireEvent.click(screen.getByLabelText('Reset zoom'));
    expect(screen.getByText('History')).toBeTruthy();
    expect(screen.getByText(/User reported a blocking bug/)).toBeTruthy();
  });

  it('keeps an observation that sits exactly on the edge of the zoom range', () => {
    // Domain is message-derived: [10:00, 10:05]. om-1 is at 10:01 — exactly 20%
    // along the track — and om-2 at 10:05.
    render(<MemoryStudioPanel messages={memoryMessages} omRecords={omHistoryRecords} />);

    const track = document.querySelector('.cursor-pointer.select-none') as HTMLElement;
    track.getBoundingClientRect = () => ({ left: 0, width: 100, top: 0, height: 24 }) as DOMRect;
    // mousedown at the left edge grabs the left handle; drag it onto om-1's own
    // timestamp, which must stay in range rather than fall off it.
    fireEvent.mouseDown(track, { clientX: 0 });
    fireEvent.mouseMove(window, { clientX: 20 });
    fireEvent.mouseUp(window);

    expect(screen.getByText('History')).toBeTruthy();
    expect(screen.getByRole('button', { name: /User asked about onboarding/ })).toBeTruthy();
  });

  it('drops an observation that falls before the zoomed range', () => {
    render(<MemoryStudioPanel messages={memoryMessages} omRecords={omHistoryRecords} />);

    const track = document.querySelector('.cursor-pointer.select-none') as HTMLElement;
    track.getBoundingClientRect = () => ({ left: 0, width: 100, top: 0, height: 24 }) as DOMRect;
    // Drag the left handle past om-1 (10:01) while the right bound stays put.
    fireEvent.mouseDown(track, { clientX: 0 });
    fireEvent.mouseMove(window, { clientX: 60 });
    fireEvent.mouseUp(window);

    expect(screen.queryByRole('button', { name: /User asked about onboarding/ })).toBeNull();
    expect(
      within(screen.getByTestId('observation-detail-body')).getByText(/User reported a blocking bug/),
    ).toBeTruthy();
  });

  it('falls back to the marker-derived window state when no contextWindow is supplied', () => {
    render(<MemoryStudioPanel messages={memoryMessages} omRecords={omHistoryRecords} />);

    // Marker-derived active window: messages 540/2000 → 0.5/2k (Messages bar)
    // and observations 320/1000 → 0.3/1k (Observations bar).
    expect(screen.getByText('0.5/2k')).toBeTruthy();
    expect(screen.getByText('0.3/1k')).toBeTruthy();
    expect(screen.queryByText('14.2/30k')).toBeNull();
    const barLabels = Array.from(document.querySelectorAll('span.uppercase.tracking-wide')).map(el => el.textContent);
    expect(barLabels).toContain('Observations');
  });
});

describe('MemoryStudioPanel — the replay cursor', () => {
  it('pins nothing of its own when the cursor sits before every observation', () => {
    const cursor = new Date('2026-06-01T09:59:00.000Z').getTime();
    render(<MemoryStudioPanel messages={memoryMessages} omRecords={omHistoryRecords} selectedTimestamp={cursor} />);

    // Nothing was observed that early, so the panel names no record and the
    // detail view keeps showing the latest rather than going blank.
    const body = screen.getByTestId('observation-detail-body');
    expect(within(body).getByText(/User reported a blocking bug/)).toBeTruthy();
    expect(within(body).queryByText(/User asked about onboarding/)).toBeNull();
  });

  it('overrides a manual pick from the history list', () => {
    const { rerender } = render(<MemoryStudioPanel messages={memoryMessages} omRecords={omHistoryRecords} />);

    // Pick the earlier record by hand from the History rail.
    fireEvent.click(screen.getByRole('button', { name: /User asked about onboarding/ }));
    expect(within(screen.getByTestId('observation-detail-body')).getByText(/User asked about onboarding/)).toBeTruthy();

    // A replay cursor arrives and takes over the selection.
    rerender(
      <MemoryStudioPanel
        messages={memoryMessages}
        omRecords={omHistoryRecords}
        selectedTimestamp={new Date('2026-06-01T10:06:00.000Z').getTime()}
      />,
    );

    expect(
      within(screen.getByTestId('observation-detail-body')).getByText(/User reported a blocking bug/),
    ).toBeTruthy();
  });
});

describe('MemoryStudioPanel — the context window', () => {
  it('takes each threshold from whichever source has it', () => {
    render(
      <MemoryStudioPanel
        messages={memoryMessages}
        omRecords={omHistoryRecords}
        contextWindow={{ memoryTokens: 4500, memoryThreshold: 6000 }}
      />,
    );

    // Observations come from the caller; messages still come from the markers.
    expect(screen.getByText('4.5/6k')).toBeTruthy();
    expect(screen.getByText('0.5/2k')).toBeTruthy();
  });

  it('keeps the marker values when the caller supplies an empty window', () => {
    render(<MemoryStudioPanel messages={memoryMessages} omRecords={omHistoryRecords} contextWindow={{}} />);

    expect(screen.getByText('0.5/2k')).toBeTruthy();
    expect(screen.getByText('0.3/1k')).toBeTruthy();
  });
});

describe('MemoryStudioPanel — without messages', () => {
  it('still lists the observations it was given', () => {
    render(<MemoryStudioPanel messages={[]} omRecords={omHistoryRecords} />);

    // No message-derived domain, so the range must not filter the records out.
    expect(screen.getByText('History')).toBeTruthy();
    expect(
      within(screen.getByTestId('observation-detail-body')).getByText(/User reported a blocking bug/),
    ).toBeTruthy();
  });

  it('renders without an onClose handler', () => {
    render(<MemoryStudioPanel messages={memoryMessages} omRecords={omHistoryRecords} />);

    expect(() => fireEvent.click(screen.getByRole('button', { name: 'Back to memory' }))).not.toThrow();
  });
});

describe('MemoryStudioPanel — with nothing to derive a window from', () => {
  it('renders without a marker-derived window to read', () => {
    expect(() => render(<MemoryStudioPanel messages={[]} omRecords={[]} />)).not.toThrow();
  });

  it('still shows the caller’s window when there is no marker-derived one', () => {
    render(
      <MemoryStudioPanel
        messages={[]}
        omRecords={[]}
        contextWindow={{ messageTokens: 14200, messageThreshold: 30000 }}
      />,
    );

    expect(screen.getByText('14.2/30k')).toBeTruthy();
  });
});

describe('MemoryStudioPanel — following its props', () => {
  it('re-reads the window when new messages arrive', () => {
    const { rerender } = render(<MemoryStudioPanel messages={[]} omRecords={omHistoryRecords} />);
    expect(screen.queryByText('0.5/2k')).toBeNull();

    rerender(<MemoryStudioPanel messages={memoryMessages} omRecords={omHistoryRecords} />);

    expect(screen.getByText('0.5/2k')).toBeTruthy();
  });

  it('re-reads the window when new observations arrive', () => {
    const { rerender } = render(<MemoryStudioPanel messages={memoryMessages} omRecords={[]} />);

    rerender(<MemoryStudioPanel messages={memoryMessages} omRecords={omHistoryRecords} />);

    expect(
      within(screen.getByTestId('observation-detail-body')).getByText(/User reported a blocking bug/),
    ).toBeTruthy();
  });

  it('opens the range back up when the thread it is showing changes', () => {
    const { rerender } = render(<MemoryStudioPanel messages={memoryMessages} omRecords={omHistoryRecords} />);

    const track = document.querySelector('.cursor-pointer.select-none') as HTMLElement;
    track.getBoundingClientRect = () => ({ left: 0, width: 100, top: 0, height: 24 }) as DOMRect;
    fireEvent.mouseDown(track, { clientX: 100 });
    fireEvent.mouseMove(window, { clientX: 40 });
    fireEvent.mouseUp(window);
    expect(screen.queryByText('History')).toBeNull();

    // A different thread spans a different stretch of time, so the old zoom
    // means nothing and the whole new range is shown.
    rerender(
      <MemoryStudioPanel
        messages={memoryMessages.map(message => ({
          ...message,
          createdAt: new Date(new Date(message.createdAt).getTime() + 86_400_000),
        }))}
        omRecords={omHistoryRecords}
      />,
    );

    expect(screen.getByText('History')).toBeTruthy();
  });
});
