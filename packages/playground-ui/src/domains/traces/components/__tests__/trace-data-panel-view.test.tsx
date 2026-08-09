// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TraceDataPanelView } from '../trace-data-panel-view';
import type { TraceDataPanelViewProps } from '../trace-data-panel-view';
import { rootSpanFixture } from './fixtures/trace-data-panel-view';

const baseProps: TraceDataPanelViewProps = {
  traceId: 'trace-1',
  spans: rootSpanFixture,
  onClose: vi.fn(),
  placement: 'traces-list',
};

// jsdom has no layout, so it ships no scrollIntoView.
const scrollIntoView = vi.fn();
Element.prototype.scrollIntoView = scrollIntoView;

afterEach(() => {
  cleanup();
  scrollIntoView.mockClear();
});

describe('TraceDataPanelView — Add tool mocks to item', () => {
  it('fires onAddTraceMocksToItem with the traceId when the button is clicked', () => {
    const onAddTraceMocksToItem = vi.fn();
    render(<TraceDataPanelView {...baseProps} onAddTraceMocksToItem={onAddTraceMocksToItem} />);

    fireEvent.click(screen.getByRole('button', { name: /add tool mocks to item/i }));

    expect(onAddTraceMocksToItem).toHaveBeenCalledTimes(1);
    expect(onAddTraceMocksToItem).toHaveBeenCalledWith({ traceId: 'trace-1' });
  });

  it('does not render the button when the prop is omitted', () => {
    render(<TraceDataPanelView {...baseProps} />);

    expect(screen.queryByRole('button', { name: /add tool mocks to item/i })).toBeNull();
  });
});

describe('TraceDataPanelView — span selected from the URL', () => {
  describe('when the trace is still loading', () => {
    it('keeps the requested span instead of clearing it', () => {
      const onSpanSelect = vi.fn();
      const { rerender } = render(
        <TraceDataPanelView {...baseProps} spans={[]} isLoading initialSpanId="root" onSpanSelect={onSpanSelect} />,
      );

      expect(onSpanSelect).not.toHaveBeenCalled();

      rerender(
        <TraceDataPanelView
          {...baseProps}
          spans={rootSpanFixture}
          isLoading={false}
          initialSpanId="root"
          onSpanSelect={onSpanSelect}
        />,
      );

      expect(onSpanSelect).toHaveBeenCalledWith('root');
    });

    it('scrolls the requested span into view once the timeline renders', () => {
      const { rerender } = render(<TraceDataPanelView {...baseProps} spans={[]} isLoading initialSpanId="root" />);
      rerender(<TraceDataPanelView {...baseProps} spans={rootSpanFixture} isLoading={false} initialSpanId="root" />);

      expect(scrollIntoView).toHaveBeenCalled();
    });
  });

  describe('when the loaded trace has no such span', () => {
    it('clears the selection', () => {
      const onSpanSelect = vi.fn();
      render(<TraceDataPanelView {...baseProps} initialSpanId="span-does-not-exist" onSpanSelect={onSpanSelect} />);

      expect(onSpanSelect).toHaveBeenCalledWith(undefined);
    });
  });
});
