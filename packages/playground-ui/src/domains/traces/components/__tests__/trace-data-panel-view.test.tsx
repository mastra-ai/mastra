// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TraceDataPanelView } from '../trace-data-panel-view';
import type { TraceDataPanelViewProps } from '../trace-data-panel-view';
import { nestedSpanFixture, rootSpanFixture } from './fixtures/trace-data-panel-view';

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

describe('TraceDataPanelView — review mode', () => {
  describe('when readable review content is provided', () => {
    it('shows the review content instead of the technical timeline', () => {
      render(
        <TraceDataPanelView
          {...baseProps}
          viewMode="review"
          onViewModeChange={vi.fn()}
          reviewSlot={<div>Readable clinical review</div>}
        />,
      );

      expect(screen.getByText('Readable clinical review')).not.toBeNull();
      expect(screen.queryByText('agent run')).toBeNull();
    });

    it('lets the user switch to the advanced trace', () => {
      const onViewModeChange = vi.fn();
      render(
        <TraceDataPanelView
          {...baseProps}
          viewMode="review"
          onViewModeChange={onViewModeChange}
          reviewSlot={<div>Readable clinical review</div>}
        />,
      );

      fireEvent.click(screen.getByRole('tab', { name: 'Advanced' }));

      expect(onViewModeChange).toHaveBeenCalledWith('advanced');
    });
  });

  describe('when advanced mode is selected', () => {
    it('shows the technical timeline', () => {
      render(
        <TraceDataPanelView
          {...baseProps}
          viewMode="advanced"
          onViewModeChange={vi.fn()}
          reviewSlot={<div>Readable clinical review</div>}
        />,
      );

      expect(screen.getByText('agent run')).not.toBeNull();
      expect(screen.queryByText('Readable clinical review')).toBeNull();
    });
  });
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

describe('TraceDataPanelView — trace usage summary', () => {
  it('renders token and cost rows when usage is provided', () => {
    render(
      <TraceDataPanelView
        {...baseProps}
        usage={{ inputTokens: 1200, outputTokens: 300, estimatedCost: 0.0042, costUnit: 'usd' }}
      />,
    );

    expect(screen.getByText('Trace input tokens')).not.toBeNull();
    expect(screen.getByText('1.2K')).not.toBeNull();
    expect(screen.getByText('Trace output tokens')).not.toBeNull();
    expect(screen.getByText('300')).not.toBeNull();
    expect(screen.getByText('Trace est. cost')).not.toBeNull();
    expect(screen.getByText('$0.0042')).not.toBeNull();
  });

  it('renders a placeholder when the store produced no cost for the trace', () => {
    render(<TraceDataPanelView {...baseProps} usage={{ inputTokens: 1200, outputTokens: 300 }} />);

    expect(screen.getByText('Trace est. cost')).not.toBeNull();
    expect(screen.getByText('—')).not.toBeNull();
  });

  it('renders no usage rows when the prop is omitted', () => {
    render(<TraceDataPanelView {...baseProps} />);

    expect(screen.queryByText('Trace est. cost')).toBeNull();
    expect(screen.queryByText('Trace input tokens')).toBeNull();
  });

  it('does not render full-trace usage for a subtrace anchor', () => {
    render(
      <TraceDataPanelView
        {...baseProps}
        spans={nestedSpanFixture}
        anchorSpanId="child"
        usage={{ inputTokens: 12_500, outputTokens: 405, estimatedCost: 0.01, costUnit: 'usd' }}
      />,
    );

    expect(screen.queryByText('Trace est. cost')).toBeNull();
    expect(screen.queryByText('12.5K')).toBeNull();
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

    it('scrolls a nested span into view once its parent expands', () => {
      const { rerender } = render(<TraceDataPanelView {...baseProps} spans={[]} isLoading initialSpanId="child" />);
      rerender(<TraceDataPanelView {...baseProps} spans={nestedSpanFixture} isLoading={false} initialSpanId="child" />);

      expect(scrollIntoView).toHaveBeenCalledTimes(1);
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
