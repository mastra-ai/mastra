// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest';

import { timestampsToTDomain } from '../../lib/timeline';
import { FlameGraph, FlameTooltip } from '../flame-graph';
import { memoryMessages, omHistoryRecords } from './fixtures/memory-studio';

const tDomain = timestampsToTDomain(memoryMessages.map(m => new Date(m.createdAt).toISOString()));
const markers: never[] = [];

afterEach(() => {
  cleanup();
});

// Recharts' ResponsiveContainer needs a measurable size in jsdom.
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(120);
});

describe('FlameGraph', () => {
  it('renders the zoom controls in uncontrolled mode without crashing', () => {
    render(<FlameGraph omRecords={omHistoryRecords} markers={markers} messages={memoryMessages} tDomain={tDomain} />);

    expect(screen.getByLabelText('Reset zoom')).toBeTruthy();
  });

  it('fires onZoomRangeChange with an updated epoch-ms range when a zoom handle is dragged', () => {
    const onZoomRangeChange = vi.fn();
    render(
      <FlameGraph
        omRecords={omHistoryRecords}
        markers={markers}
        messages={memoryMessages}
        tDomain={tDomain}
        zoomRange={{ left: tDomain.tMin, right: tDomain.tMax }}
        onZoomRangeChange={onZoomRangeChange}
      />,
    );

    // The zoom track is the cursor-pointer div next to the "Zoom" label. Give it
    // a non-zero rect (jsdom returns zeros) so a fractional drag position maps to
    // a real timestamp inside the domain.
    const track = document.querySelector('[data-zoom-track]') as HTMLElement;
    expect(track).toBeTruthy();
    track.getBoundingClientRect = () => ({ left: 0, width: 100, top: 0, height: 24 }) as DOMRect;

    // mousedown near the left edge selects the left handle; moving to the middle
    // drags the left bound toward the domain midpoint.
    fireEvent.mouseDown(track, { clientX: 0 });
    fireEvent.mouseMove(window, { clientX: 50 });
    fireEvent.mouseUp(window);

    expect(onZoomRangeChange).toHaveBeenCalled();
    const lastCall = onZoomRangeChange.mock.calls.at(-1);
    assert(lastCall, 'Expected zoom range change call');
    const [lastRange] = lastCall as [{ left: number; right: number }];
    // Dragging the left handle to the middle of the track moves left toward the
    // midpoint of the domain, so it is now greater than the domain minimum.
    expect(lastRange.left).toBeGreaterThan(tDomain.tMin);
    expect(lastRange.right).toBe(tDomain.tMax);
  });

  it('fires onZoomRangeChange with the full domain when Reset zoom is clicked', () => {
    const onZoomRangeChange = vi.fn();
    render(
      <FlameGraph
        omRecords={omHistoryRecords}
        markers={markers}
        messages={memoryMessages}
        tDomain={tDomain}
        zoomRange={{ left: tDomain.tMin + 10, right: tDomain.tMax - 10 }}
        onZoomRangeChange={onZoomRangeChange}
      />,
    );

    fireEvent.click(screen.getByLabelText('Reset zoom'));

    expect(onZoomRangeChange).toHaveBeenCalledWith({ left: tDomain.tMin, right: tDomain.tMax });
  });
});

describe('FlameGraph rows', () => {
  it('always charts the messages and observations rows', () => {
    render(<FlameGraph omRecords={omHistoryRecords} markers={markers} messages={memoryMessages} tDomain={tDomain} />);

    expect(screen.getByText('Messages')).toBeTruthy();
    expect(screen.getByText('Observations')).toBeTruthy();
    expect(screen.getByText('Time')).toBeTruthy();
    expect(screen.getByText('Zoom')).toBeTruthy();
  });

  it('adds an events row only once there are observations to mark', () => {
    render(<FlameGraph omRecords={omHistoryRecords} markers={markers} messages={memoryMessages} tDomain={tDomain} />);
    expect(screen.getByText('Events')).toBeTruthy();

    cleanup();

    render(<FlameGraph omRecords={[]} markers={markers} messages={memoryMessages} tDomain={tDomain} />);
    expect(screen.queryByText('Events')).toBeNull();
  });

  it('adds a buffered row only once something has actually been buffered', () => {
    render(<FlameGraph omRecords={omHistoryRecords} markers={markers} messages={memoryMessages} tDomain={tDomain} />);
    expect(screen.queryByText('Buffered obs')).toBeNull();

    cleanup();

    render(
      <FlameGraph
        omRecords={omHistoryRecords}
        markers={[{ type: 'buffering-end', timestamp: '2026-06-01T10:02:00.000Z', observationTokens: 300 }]}
        messages={memoryMessages}
        tDomain={tDomain}
      />,
    );
    expect(screen.getByText('Buffered obs')).toBeTruthy();
  });

  it('renders nothing at all when there is no series to chart', () => {
    const { container } = render(<FlameGraph omRecords={[]} markers={[]} messages={[]} tDomain={tDomain} />);

    expect(container.innerHTML).toBe('');
  });

  it.each([
    ['only messages', { omRecords: [], markers: [] as never[], messages: memoryMessages }],
    ['only observation records', { omRecords: omHistoryRecords, markers: [] as never[], messages: [] }],
    [
      'only stream markers',
      {
        omRecords: [],
        markers: [{ type: 'status', timestamp: '2026-06-01T10:02:00.000Z', pendingTokens: 120 }],
        messages: [],
      },
    ],
  ])('charts a thread carrying %s', (_, props) => {
    render(<FlameGraph {...props} tDomain={tDomain} />);

    expect(screen.getByText('Messages')).toBeTruthy();
  });

  it('still renders when the only thing it has is messages', () => {
    render(<FlameGraph omRecords={[]} markers={[]} messages={memoryMessages} tDomain={tDomain} />);

    expect(screen.getByText('Messages')).toBeTruthy();
    expect(screen.queryByText('Events')).toBeNull();
  });

  it('labels the time axis across the whole domain', () => {
    const { container } = render(
      <FlameGraph omRecords={omHistoryRecords} markers={markers} messages={memoryMessages} tDomain={tDomain} />,
    );

    const axis = screen.getByText('Time').nextElementSibling;
    // Five evenly spaced ticks: the two ends plus the quarter marks.
    expect(axis?.children).toHaveLength(5);
    expect(new Set(Array.from(axis?.children ?? []).map(tick => tick.textContent)).size).toBeGreaterThan(1);
    expect(container).toBeTruthy();
  });
});

describe('FlameGraph zoom track', () => {
  const trackOf = () => document.querySelector('[data-zoom-track]') as HTMLElement;
  const partOf = (part: 'before' | 'band' | 'after') =>
    trackOf().querySelector(`[data-zoom-part="${part}"]`) as HTMLElement;
  const handleOf = (side: 'left' | 'right') => trackOf().querySelector(`[data-zoom-handle="${side}"]`) as HTMLElement;

  it('shades the part of the domain the zoom range excludes', () => {
    render(
      <FlameGraph
        omRecords={omHistoryRecords}
        markers={markers}
        messages={memoryMessages}
        tDomain={tDomain}
        zoomRange={{ left: tDomain.tMin + (tDomain.tMax - tDomain.tMin) * 0.25, right: tDomain.tMax }}
        onZoomRangeChange={vi.fn()}
      />,
    );

    expect(partOf('before').style.width).toBe('25%');
  });

  it('draws the selected band and its handles at the zoomed edges', () => {
    const span = tDomain.tMax - tDomain.tMin;
    render(
      <FlameGraph
        omRecords={omHistoryRecords}
        markers={markers}
        messages={memoryMessages}
        tDomain={tDomain}
        zoomRange={{ left: tDomain.tMin + span * 0.25, right: tDomain.tMin + span * 0.75 }}
        onZoomRangeChange={vi.fn()}
      />,
    );

    const [band, leftHandle, rightHandle] = [partOf('band'), handleOf('left'), handleOf('right')];

    expect(partOf('before').style.width).toBe('25%');
    expect(partOf('after').style.width).toBe('25%');
    expect(band?.style.left).toBe('25%');
    expect(band?.style.right).toBe('25%');
    // Each handle straddles its own edge rather than sitting beside it.
    expect(leftHandle?.style.left).toBe('25%');
    expect(leftHandle?.style.transform).toBe('translateX(-50%)');
    expect(rightHandle?.style.left).toBe('75%');
    expect(rightHandle?.style.transform).toBe('translateX(-50%)');
  });

  it('drags whichever handle was grabbed directly, however far away it is', () => {
    const onZoomRangeChange = vi.fn();
    render(
      <FlameGraph
        omRecords={omHistoryRecords}
        markers={markers}
        messages={memoryMessages}
        tDomain={tDomain}
        zoomRange={{ left: tDomain.tMin, right: tDomain.tMax }}
        onZoomRangeChange={onZoomRangeChange}
      />,
    );

    const track = trackOf();
    track.getBoundingClientRect = () => ({ left: 0, width: 100, top: 0, height: 24 }) as DOMRect;
    const rightHandle = handleOf('right');

    // Grabbing the right handle near the left edge must still move the right
    // bound — the handle wins over the nearest-edge guess.
    fireEvent.mouseDown(rightHandle, { clientX: 5 });
    fireEvent.mouseMove(window, { clientX: 30 });
    fireEvent.mouseUp(window);

    const range = onZoomRangeChange.mock.calls.at(-1)?.[0] as { left: number; right: number };
    expect(range.left).toBe(tDomain.tMin);
    expect(range.right).toBeLessThan(tDomain.tMax);
  });

  it('drags the left handle when it is the one grabbed', () => {
    const onZoomRangeChange = vi.fn();
    render(
      <FlameGraph
        omRecords={omHistoryRecords}
        markers={markers}
        messages={memoryMessages}
        tDomain={tDomain}
        zoomRange={{ left: tDomain.tMin, right: tDomain.tMax }}
        onZoomRangeChange={onZoomRangeChange}
      />,
    );

    const track = trackOf();
    track.getBoundingClientRect = () => ({ left: 0, width: 100, top: 0, height: 24 }) as DOMRect;
    const leftHandle = handleOf('left');

    fireEvent.mouseDown(leftHandle, { clientX: 95 });
    fireEvent.mouseMove(window, { clientX: 40 });
    fireEvent.mouseUp(window);

    const range = onZoomRangeChange.mock.calls.at(-1)?.[0] as { left: number; right: number };
    expect(range.left).toBeGreaterThan(tDomain.tMin);
    expect(range.right).toBe(tDomain.tMax);
  });

  it('grabbing a handle does not also move it to where the mouse went down', () => {
    const onZoomRangeChange = vi.fn();
    render(
      <FlameGraph
        omRecords={omHistoryRecords}
        markers={markers}
        messages={memoryMessages}
        tDomain={tDomain}
        zoomRange={{ left: tDomain.tMin, right: tDomain.tMax }}
        onZoomRangeChange={onZoomRangeChange}
      />,
    );

    const track = trackOf();
    track.getBoundingClientRect = () => ({ left: 0, width: 100, top: 0, height: 24 }) as DOMRect;

    fireEvent.mouseDown(handleOf('left'), { clientX: 50 });

    // The press only picks the handle up; the range moves once the mouse does.
    expect(onZoomRangeChange).not.toHaveBeenCalled();
  });

  it('shows the whole domain as selected when nothing is zoomed', () => {
    render(
      <FlameGraph
        omRecords={omHistoryRecords}
        markers={markers}
        messages={memoryMessages}
        tDomain={tDomain}
        zoomRange={{ left: tDomain.tMin, right: tDomain.tMax }}
        onZoomRangeChange={vi.fn()}
      />,
    );

    const track = trackOf();
    expect((track.querySelector('[data-zoom-part="before"]') as HTMLElement).style.width).toBe('0%');
    expect(partOf('after').style.width).toBe('0%');
  });

  it('grabs whichever handle the click landed nearer to', () => {
    const onZoomRangeChange = vi.fn();
    render(
      <FlameGraph
        omRecords={omHistoryRecords}
        markers={markers}
        messages={memoryMessages}
        tDomain={tDomain}
        zoomRange={{ left: tDomain.tMin, right: tDomain.tMax }}
        onZoomRangeChange={onZoomRangeChange}
      />,
    );

    const track = trackOf();
    track.getBoundingClientRect = () => ({ left: 0, width: 100, top: 0, height: 24 }) as DOMRect;

    // Nearer the right end → the right bound moves and the left one stays put.
    fireEvent.mouseDown(track, { clientX: 90 });
    fireEvent.mouseUp(window);

    const range = onZoomRangeChange.mock.calls.at(-1)?.[0] as { left: number; right: number };
    expect(range.left).toBe(tDomain.tMin);
    expect(range.right).toBeLessThan(tDomain.tMax);
  });

  it('grabs the left handle when the click is exactly between the two', () => {
    const onZoomRangeChange = vi.fn();
    const span = tDomain.tMax - tDomain.tMin;
    render(
      <FlameGraph
        omRecords={omHistoryRecords}
        markers={markers}
        messages={memoryMessages}
        tDomain={tDomain}
        zoomRange={{ left: tDomain.tMin + span * 0.2, right: tDomain.tMin + span * 0.8 }}
        onZoomRangeChange={onZoomRangeChange}
      />,
    );

    const track = trackOf();
    track.getBoundingClientRect = () => ({ left: 0, width: 100, top: 0, height: 24 }) as DOMRect;

    // Dead centre between the handles — the tie goes to the left one.
    fireEvent.mouseDown(track, { clientX: 50 });
    fireEvent.mouseUp(window);

    const range = onZoomRangeChange.mock.calls.at(-1)?.[0] as { left: number; right: number };
    expect(range.left).toBeCloseTo(tDomain.tMin + span * 0.5, 5);
    expect(range.right).toBeCloseTo(tDomain.tMin + span * 0.8, 5);
  });

  it('never lets a handle cross the other one', () => {
    const onZoomRangeChange = vi.fn();
    const mid = tDomain.tMin + (tDomain.tMax - tDomain.tMin) * 0.5;
    render(
      <FlameGraph
        omRecords={omHistoryRecords}
        markers={markers}
        messages={memoryMessages}
        tDomain={tDomain}
        zoomRange={{ left: tDomain.tMin, right: mid }}
        onZoomRangeChange={onZoomRangeChange}
      />,
    );

    const track = trackOf();
    track.getBoundingClientRect = () => ({ left: 0, width: 100, top: 0, height: 24 }) as DOMRect;

    // Grab the left handle and drag it past the right one.
    fireEvent.mouseDown(track, { clientX: 0 });
    fireEvent.mouseMove(window, { clientX: 90 });
    fireEvent.mouseUp(window);

    const range = onZoomRangeChange.mock.calls.at(-1)?.[0] as { left: number; right: number };
    expect(range.left).toBe(mid);
  });

  it('clamps a drag that leaves the track altogether', () => {
    const onZoomRangeChange = vi.fn();
    render(
      <FlameGraph
        omRecords={omHistoryRecords}
        markers={markers}
        messages={memoryMessages}
        tDomain={tDomain}
        zoomRange={{ left: tDomain.tMin + 10, right: tDomain.tMax }}
        onZoomRangeChange={onZoomRangeChange}
      />,
    );

    const track = trackOf();
    track.getBoundingClientRect = () => ({ left: 0, width: 100, top: 0, height: 24 }) as DOMRect;

    fireEvent.mouseDown(track, { clientX: 0 });
    fireEvent.mouseMove(window, { clientX: -500 });
    fireEvent.mouseUp(window);

    const range = onZoomRangeChange.mock.calls.at(-1)?.[0] as { left: number; right: number };
    expect(range.left).toBe(tDomain.tMin);
  });

  it('stops following the mouse once the button is released', () => {
    const onZoomRangeChange = vi.fn();
    render(
      <FlameGraph
        omRecords={omHistoryRecords}
        markers={markers}
        messages={memoryMessages}
        tDomain={tDomain}
        zoomRange={{ left: tDomain.tMin, right: tDomain.tMax }}
        onZoomRangeChange={onZoomRangeChange}
      />,
    );

    const track = trackOf();
    track.getBoundingClientRect = () => ({ left: 0, width: 100, top: 0, height: 24 }) as DOMRect;

    fireEvent.mouseDown(track, { clientX: 0 });
    fireEvent.mouseUp(window);
    onZoomRangeChange.mockClear();

    fireEvent.mouseMove(window, { clientX: 50 });

    expect(onZoomRangeChange).not.toHaveBeenCalled();
  });

  it('keeps its own range when the caller gives it no handler to report to', () => {
    render(
      <FlameGraph
        omRecords={omHistoryRecords}
        markers={markers}
        messages={memoryMessages}
        tDomain={tDomain}
        zoomRange={{ left: tDomain.tMin, right: tDomain.tMax }}
      />,
    );

    const track = trackOf();
    track.getBoundingClientRect = () => ({ left: 0, width: 100, top: 0, height: 24 }) as DOMRect;

    fireEvent.mouseDown(track, { clientX: 0 });
    fireEvent.mouseMove(window, { clientX: 40 });
    fireEvent.mouseUp(window);

    // Uncontrolled: the range it shows is its own, not the one it was handed.
    expect((track.querySelector('[data-zoom-part="before"]') as HTMLElement).style.width).toBe('40%');
  });

  it('puts its own range back on reset when it owns it', () => {
    render(<FlameGraph omRecords={omHistoryRecords} markers={markers} messages={memoryMessages} tDomain={tDomain} />);

    const track = trackOf();
    track.getBoundingClientRect = () => ({ left: 0, width: 100, top: 0, height: 24 }) as DOMRect;

    fireEvent.mouseDown(track, { clientX: 0 });
    fireEvent.mouseMove(window, { clientX: 40 });
    fireEvent.mouseUp(window);
    expect((track.querySelector('[data-zoom-part="before"]') as HTMLElement).style.width).toBe('40%');

    fireEvent.click(screen.getByLabelText('Reset zoom'));

    expect((track.querySelector('[data-zoom-part="before"]') as HTMLElement).style.width).toBe('0%');
  });

  it('sits at the full width for a domain with no span at all', () => {
    render(
      <FlameGraph
        omRecords={omHistoryRecords}
        markers={markers}
        messages={memoryMessages}
        tDomain={{ tMin: 5, tMax: 5 }}
      />,
    );

    const track = trackOf();
    // Nothing to divide by, so the whole track reads as selected.
    expect((track.querySelector('[data-zoom-part="before"]') as HTMLElement).style.width).toBe('0%');
    expect(partOf('after').style.width).toBe('0%');
  });
});

// Timestamp selection has no test here on purpose. Both halves of it — the
// `cursor-pointer` affordance and the chart-level `onClick` — sit on a recharts
// component, and recharts lays out nothing under jsdom, so neither reaches the
// DOM. What the click decides is `toSelectedT`, covered in flame-graph-data.test.ts.

describe('FlameTooltip', () => {
  const entry = (name: string, value: unknown, t?: number) => ({ name, value, payload: t == null ? {} : { t } });

  it('says nothing while the pointer is away', () => {
    const { container } = render(<FlameTooltip payload={[entry('tokens', 5, 0.5)]} domain={tDomain} />);

    expect(container.innerHTML).toBe('');
  });

  it('says nothing with no series under the pointer', () => {
    const { container } = render(<FlameTooltip active payload={[]} domain={tDomain} />);

    expect(container.innerHTML).toBe('');
  });

  it('says nothing when there is no payload at all', () => {
    const { container } = render(<FlameTooltip active domain={tDomain} />);

    expect(container.innerHTML).toBe('');
  });

  it('shows only the time for a row with nothing to quantify', () => {
    const { container } = render(<FlameTooltip active payload={[entry('tokens', 1200, 0.5)]} domain={tDomain} />);

    expect(container.textContent).not.toContain('1,200');
    expect(container.textContent).not.toBe('');
    expect(container.querySelectorAll('span')).toHaveLength(1);
  });

  it('leaves the plain tooltip empty when there is no time to show', () => {
    const { container } = render(<FlameTooltip active payload={[entry('tokens', 1200)]} domain={tDomain} />);

    // No blank span padding out an otherwise empty box.
    expect(container.querySelector('span')).toBeNull();
    expect(container.textContent).toBe('');
  });

  it('shows each series value alongside the time when asked to', () => {
    render(
      <FlameTooltip
        active
        showValue
        payload={[entry('pendingMessageTokens', 1200.4, 0.5), entry('observationTokenCount', 320)]}
        domain={tDomain}
      />,
    );

    expect(screen.getByText('time')).toBeTruthy();
    expect(screen.getByText('pendingMessageTokens')).toBeTruthy();
    // Rounded and grouped, so a fractional chart value still reads as a count.
    expect(screen.getByText('1,200')).toBeTruthy();
    expect(screen.getByText('320')).toBeTruthy();
  });

  it('leaves out the axis series, which are not readings', () => {
    render(
      <FlameTooltip
        active
        showValue
        payload={[entry('t', 0.5, 0.5), entry('time', 'x'), entry('tokens', 320)]}
        domain={tDomain}
      />,
    );

    expect(screen.queryByText('t')).toBeNull();
    // `time` survives once, as the moment's own label — not as a reading.
    expect(screen.getAllByText('time')).toHaveLength(1);
    expect(screen.queryByText('x')).toBeNull();
    expect(screen.getByText('tokens')).toBeTruthy();
  });

  it('leaves out a series with no reading at this moment', () => {
    render(
      <FlameTooltip active showValue payload={[entry('missing', null, 0.5), entry('tokens', 320)]} domain={tDomain} />,
    );

    expect(screen.queryByText('missing')).toBeNull();
    expect(screen.getByText('tokens')).toBeTruthy();
  });

  it('prints a non-numeric value as it stands', () => {
    render(<FlameTooltip active showValue payload={[entry('role', 'assistant', 0.5)]} domain={tDomain} />);

    expect(screen.getByText('assistant')).toBeTruthy();
  });

  it('omits the time when it has no domain to place it in', () => {
    render(<FlameTooltip active showValue payload={[entry('tokens', 320, 0.5)]} />);

    expect(screen.queryByText('time')).toBeNull();
    expect(screen.getByText('320')).toBeTruthy();
  });

  it('omits the time when the point carries none', () => {
    render(<FlameTooltip active showValue payload={[entry('tokens', 320)]} domain={tDomain} />);

    expect(screen.queryByText('time')).toBeNull();
    expect(screen.getByText('320')).toBeTruthy();
  });
});
