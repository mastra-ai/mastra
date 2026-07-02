// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { timestampsToTDomain } from '../../lib/timeline';
import { FlameGraph } from '../flame-graph';
import { memoryMessages, omHistoryRecords } from './fixtures/memory-studio';
import { assertDefined } from '@/test-utils/assert';

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
    const track = document.querySelector('.cursor-pointer.select-none') as HTMLElement;
    expect(track).toBeTruthy();
    track.getBoundingClientRect = () => ({ left: 0, width: 100, top: 0, height: 24 }) as DOMRect;

    // mousedown near the left edge selects the left handle; moving to the middle
    // drags the left bound toward the domain midpoint.
    fireEvent.mouseDown(track, { clientX: 0 });
    fireEvent.mouseMove(window, { clientX: 50 });
    fireEvent.mouseUp(window);

    expect(onZoomRangeChange).toHaveBeenCalled();
    const [lastRange] = assertDefined(onZoomRangeChange.mock.calls.at(-1), 'Expected zoom range change call') as [
      { left: number; right: number },
    ];
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
