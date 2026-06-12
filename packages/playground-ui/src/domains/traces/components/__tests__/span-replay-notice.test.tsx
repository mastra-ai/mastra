// @vitest-environment jsdom
import { SpanType } from '@mastra/core/observability';
import type { SpanRecord } from '@mastra/core/storage';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { getSyntheticToolReplayMarker } from '../../utils/span-utils';
import { SpanDataPanelView } from '../span-data-panel-view';
import { SpanDetailsView } from '../span-details-view';

// jsdom lacks the layout APIs CodeMirror's measure cycle touches (same
// polyfills the playground package installs globally in its vitest setup).
beforeAll(() => {
  if (!Range.prototype.getClientRects) {
    Range.prototype.getClientRects = () => {
      const rects = [] as unknown as DOMRectList;
      (rects as unknown as { item: (index: number) => DOMRect | null }).item = () => null;
      return rects;
    };
    Range.prototype.getBoundingClientRect = () => new DOMRect();
  }
  if (typeof globalThis.ResizeObserver === 'undefined') {
    class ResizeObserverPolyfill {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    globalThis.ResizeObserver = ResizeObserverPolyfill as unknown as typeof ResizeObserver;
  }
});

afterEach(cleanup);

/** Completed tool span of a replay run (synthetic markers ride in metadata). */
function makeToolSpan(metadata: SpanRecord['metadata']): SpanRecord {
  return {
    traceId: 'trace-1',
    spanId: 'span-1',
    parentSpanId: 'root-1',
    name: "tool: 'get-weather'",
    spanType: SpanType.TOOL_CALL,
    isEvent: false,
    startedAt: new Date('2026-06-01T10:00:00.000Z'),
    endedAt: new Date('2026-06-01T10:00:01.000Z'),
    input: { city: 'Paris' },
    output: { temperature: 21 },
    metadata,
    createdAt: new Date('2026-06-01T10:00:01.000Z'),
    updatedAt: null,
  };
}

describe('getSyntheticToolReplayMarker', () => {
  it('reads only the exact stamped shape', () => {
    expect(getSyntheticToolReplayMarker({ toolReplay: { synthetic: true, outcome: 'replayed', sequence: 1 } })).toEqual(
      { outcome: 'replayed', sequence: 1 },
    );
    expect(getSyntheticToolReplayMarker({ toolReplay: { synthetic: true } })).toEqual({});
    // Metadata is user-writable — near-miss shapes never read as a marker.
    expect(getSyntheticToolReplayMarker({ toolReplay: { synthetic: 'yes' } })).toBeNull();
    expect(getSyntheticToolReplayMarker({ toolReplay: 'user junk' })).toBeNull();
    expect(getSyntheticToolReplayMarker({ other: true })).toBeNull();
    expect(getSyntheticToolReplayMarker(null)).toBeNull();
    expect(getSyntheticToolReplayMarker(undefined)).toBeNull();
  });

  it('drops non-string outcomes and non-finite sequences', () => {
    expect(getSyntheticToolReplayMarker({ toolReplay: { synthetic: true, outcome: 42, sequence: 'one' } })).toEqual({});
    expect(getSyntheticToolReplayMarker({ toolReplay: { synthetic: true, sequence: Number.NaN } })).toEqual({});
  });
});

describe('SpanDataPanelView synthetic replay notice', () => {
  it('flags a replayed synthetic span with its outcome and 1-based tape position', () => {
    render(
      <SpanDataPanelView
        traceId="trace-1"
        spanId="span-1"
        span={makeToolSpan({ toolReplay: { synthetic: true, outcome: 'replayed', sequence: 1 } })}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('Synthetic replay span')).toBeDefined();
    expect(
      screen.getByText('outcome: replayed, tape #2. This call was served from a recording/mock, not executed.'),
    ).toBeDefined();
  });

  it('flags a mocked synthetic span without a tape reference', () => {
    render(
      <SpanDataPanelView
        traceId="trace-1"
        spanId="span-1"
        span={makeToolSpan({ toolReplay: { synthetic: true, outcome: 'mocked' } })}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('Synthetic replay span')).toBeDefined();
    expect(
      screen.getByText('outcome: mocked. This call was served from a recording/mock, not executed.'),
    ).toBeDefined();
  });

  it('renders no notice for live spans — even with a user-owned toolReplay key', () => {
    render(
      <SpanDataPanelView
        traceId="trace-1"
        spanId="span-1"
        span={makeToolSpan({ toolReplay: 'user junk' })}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByText('Synthetic replay span')).toBeNull();
  });
});

describe('SpanDetailsView synthetic replay notice', () => {
  it('flags synthetic spans in the compact panel too', () => {
    render(
      <SpanDetailsView
        spanId="span-1"
        span={makeToolSpan({ toolReplay: { synthetic: true, outcome: 'replayed', sequence: 0 } })}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('Synthetic replay span')).toBeDefined();
    expect(
      screen.getByText('outcome: replayed, tape #1. This call was served from a recording/mock, not executed.'),
    ).toBeDefined();
  });

  it('renders no notice without the marker', () => {
    render(<SpanDetailsView spanId="span-1" span={makeToolSpan(null)} onClose={vi.fn()} />);

    expect(screen.queryByText('Synthetic replay span')).toBeNull();
  });
});
