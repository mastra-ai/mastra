// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

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

describe('TraceDataPanelView — the header', () => {
  it('names the trace by a shortened id in the side panel', () => {
    render(<TraceDataPanelView {...baseProps} traceId="0123456789abcdef0123" />);

    expect(screen.getByText(/# 0123456789ab/)).toBeTruthy();
    expect(screen.queryByText(/0123456789abcdef0123/)).toBeNull();
  });

  it('drops the trace id, and every side-panel control, on the trace page', () => {
    render(
      <TraceDataPanelView {...baseProps} placement="trace-page" onPrevious={vi.fn()} onCollapsedChange={vi.fn()} />,
    );

    expect(screen.getByText('Trace Timeline')).toBeTruthy();
    expect(screen.queryByText(/# trace-1/)).toBeNull();
    expect(screen.queryByRole('button', { name: /previous trace/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /collapse panel/i })).toBeNull();
    // The download is the one control both layouts keep.
    expect(screen.getByRole('button', { name: 'Download trace JSON' })).toBeTruthy();
  });

  it('offers a collapse toggle only to a caller that owns the state', () => {
    const uncontrolled = render(<TraceDataPanelView {...baseProps} />);
    expect(screen.queryByRole('button', { name: /collapse panel/i })).toBeNull();
    expect(uncontrolled.container).toBeTruthy();

    cleanup();

    const onCollapsedChange = vi.fn();
    render(<TraceDataPanelView {...baseProps} onCollapsedChange={onCollapsedChange} />);

    fireEvent.click(screen.getByRole('button', { name: /collapse panel/i }));
    expect(onCollapsedChange).toHaveBeenCalledWith(true);
  });

  it('reads its collapsed label from the state the caller passes in', () => {
    render(<TraceDataPanelView {...baseProps} collapsed onCollapsedChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: /expand panel/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /collapse panel/i })).toBeNull();
  });

  it('hides the whole body while collapsed', () => {
    render(<TraceDataPanelView {...baseProps} collapsed onCollapsedChange={vi.fn()} />);

    expect(screen.queryByText('agent run')).toBeNull();
    // The header stays, so the panel can be expanded again.
    expect(screen.getByText(/# trace-1/)).toBeTruthy();
  });

  it('offers trace-to-trace navigation as soon as either direction exists', () => {
    render(<TraceDataPanelView {...baseProps} onNext={vi.fn()} />);

    expect(screen.getByRole('button', { name: /next trace/i })).toBeTruthy();
  });

  it('offers no navigation when neither direction exists', () => {
    render(<TraceDataPanelView {...baseProps} />);

    expect(screen.queryByRole('button', { name: /next trace/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /previous trace/i })).toBeNull();
  });

  it('links out to the trace page only with both a link component and an href', () => {
    const Anchor = ({ href, children, ...rest }: { href?: string; children?: React.ReactNode }) => (
      <a href={href} {...rest}>
        {children}
      </a>
    );

    const noHref = render(<TraceDataPanelView {...baseProps} LinkComponent={Anchor} />);
    expect(screen.queryByLabelText('Open trace page')).toBeNull();
    expect(noHref.container).toBeTruthy();

    cleanup();

    render(<TraceDataPanelView {...baseProps} traceHref="/traces/trace-1" />);
    expect(screen.queryByLabelText('Open trace page')).toBeNull();

    cleanup();

    render(<TraceDataPanelView {...baseProps} />);
    expect(screen.queryByLabelText('Open trace page')).toBeNull();

    cleanup();

    render(<TraceDataPanelView {...baseProps} LinkComponent={Anchor} traceHref="/traces/trace-1" />);
    expect(screen.getByRole('link', { name: 'Open trace page' }).getAttribute('href')).toBe('/traces/trace-1');
  });

  it('never links out from the trace page itself', () => {
    const Anchor = ({ href, children, ...rest }: { href?: string; children?: React.ReactNode }) => (
      <a href={href} {...rest}>
        {children}
      </a>
    );

    render(
      <TraceDataPanelView {...baseProps} placement="trace-page" LinkComponent={Anchor} traceHref="/traces/trace-1" />,
    );

    expect(screen.queryByRole('link', { name: 'Open trace page' })).toBeNull();
  });
});

describe('TraceDataPanelView — the body', () => {
  it('says it is loading rather than showing an empty trace', () => {
    render(<TraceDataPanelView {...baseProps} spans={[]} isLoading />);

    expect(screen.getByText('Loading trace...')).toBeTruthy();
    expect(screen.queryByText('No spans found for this trace.')).toBeNull();
  });

  it('says a settled trace has no spans', () => {
    render(<TraceDataPanelView {...baseProps} spans={[]} />);

    expect(screen.getByText('No spans found for this trace.')).toBeTruthy();
  });

  it('says the same when the spans never arrived at all', () => {
    render(<TraceDataPanelView {...baseProps} spans={undefined} />);

    expect(screen.getByText('No spans found for this trace.')).toBeTruthy();
  });

  it('shows the trace summary in the side panel but not on the trace page', () => {
    const sidePanel = render(<TraceDataPanelView {...baseProps} />);
    expect(screen.getByText('Status')).toBeTruthy();
    expect(sidePanel.container).toBeTruthy();

    cleanup();

    render(<TraceDataPanelView {...baseProps} placement="trace-page" />);
    expect(screen.queryByText('Status')).toBeNull();
  });
});

describe('TraceDataPanelView — the actions row', () => {
  it('explains where the missing actions live, when asked to', () => {
    render(<TraceDataPanelView {...baseProps} />);

    expect(screen.getByText(/available in Mastra Studio/)).toBeTruthy();
  });

  it('stays quiet about them when the caller asks it to', () => {
    render(<TraceDataPanelView {...baseProps} showUnavailableFeaturesMsg={false} />);

    expect(screen.queryByText(/available in Mastra Studio/)).toBeNull();
  });

  it('drops the explanation as soon as any one action is available', () => {
    render(<TraceDataPanelView {...baseProps} onEvaluateTrace={vi.fn()} />);

    expect(screen.queryByText(/available in Mastra Studio/)).toBeNull();
    expect(screen.getByRole('button', { name: /evaluate trace/i })).toBeTruthy();
  });

  it('never shows the actions row on the trace page', () => {
    render(<TraceDataPanelView {...baseProps} placement="trace-page" onEvaluateTrace={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /evaluate trace/i })).toBeNull();
    expect(screen.queryByText(/available in Mastra Studio/)).toBeNull();
  });

  it('saves the dataset item against the root span it found', () => {
    const onSaveAsDatasetItem = vi.fn();
    render(<TraceDataPanelView {...baseProps} onSaveAsDatasetItem={onSaveAsDatasetItem} />);

    fireEvent.click(screen.getByRole('button', { name: /save as dataset item/i }));

    expect(onSaveAsDatasetItem).toHaveBeenCalledWith({ traceId: 'trace-1', rootSpanId: 'root' });
  });

  it('reports the evaluation request with no arguments of its own', () => {
    const onEvaluateTrace = vi.fn();
    render(<TraceDataPanelView {...baseProps} onEvaluateTrace={onEvaluateTrace} />);

    fireEvent.click(screen.getByRole('button', { name: /evaluate trace/i }));

    expect(onEvaluateTrace).toHaveBeenCalledTimes(1);
  });
});

describe('TraceDataPanelView — span selection', () => {
  it('toggles a span off when it is clicked again', () => {
    const onSpanSelect = vi.fn();
    render(<TraceDataPanelView {...baseProps} onSpanSelect={onSpanSelect} />);

    const span = screen.getByText('agent run');
    fireEvent.click(span);
    expect(onSpanSelect).toHaveBeenLastCalledWith('root');

    fireEvent.click(span);
    expect(onSpanSelect).toHaveBeenLastCalledWith(undefined);
  });

  it('clears the selection the moment the requested span is taken away', () => {
    const onSpanSelect = vi.fn();
    const { rerender } = render(<TraceDataPanelView {...baseProps} initialSpanId="root" onSpanSelect={onSpanSelect} />);
    onSpanSelect.mockClear();

    rerender(<TraceDataPanelView {...baseProps} initialSpanId={undefined} onSpanSelect={onSpanSelect} />);

    expect(onSpanSelect).toHaveBeenCalledWith(undefined);
  });

  it('clears the selection when no span was asked for, without waiting for the trace', () => {
    const onSpanSelect = vi.fn();
    render(<TraceDataPanelView {...baseProps} spans={[]} isLoading onSpanSelect={onSpanSelect} />);

    // Nothing was asked for, so there is nothing for the data to confirm.
    expect(onSpanSelect).toHaveBeenCalledWith(undefined);
  });

  it('holds a requested span while the trace is still loading', () => {
    const onSpanSelect = vi.fn();
    render(
      <TraceDataPanelView {...baseProps} spans={[]} isLoading initialSpanId="span-1" onSpanSelect={onSpanSelect} />,
    );

    // An in-flight fetch must not wipe a selection the URL asked for.
    expect(onSpanSelect).not.toHaveBeenCalled();
  });
});

describe('TraceDataPanelView — an anchored subtrace', () => {
  it('treats the anchor span as the root the panel is describing', () => {
    const onSaveAsDatasetItem = vi.fn();
    render(
      <TraceDataPanelView
        {...baseProps}
        spans={nestedSpanFixture}
        anchorSpanId="child"
        onSaveAsDatasetItem={onSaveAsDatasetItem}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /save as dataset item/i }));

    expect(onSaveAsDatasetItem).toHaveBeenCalledWith({ traceId: 'trace-1', rootSpanId: 'child' });
  });

  it('falls back to the span with no parent when there is no anchor', () => {
    const onSaveAsDatasetItem = vi.fn();
    render(<TraceDataPanelView {...baseProps} spans={nestedSpanFixture} onSaveAsDatasetItem={onSaveAsDatasetItem} />);

    fireEvent.click(screen.getByRole('button', { name: /save as dataset item/i }));

    expect(onSaveAsDatasetItem).toHaveBeenCalledWith({ traceId: 'trace-1', rootSpanId: 'root' });
  });

  it('still names an anchored root span even when the anchor is the trace root', () => {
    const onSaveAsDatasetItem = vi.fn();
    render(
      <TraceDataPanelView
        {...baseProps}
        spans={nestedSpanFixture}
        anchorSpanId="root"
        onSaveAsDatasetItem={onSaveAsDatasetItem}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /save as dataset item/i }));

    expect(onSaveAsDatasetItem).toHaveBeenCalledWith({ traceId: 'trace-1', rootSpanId: 'root' });
  });

  it('keeps the full-trace totals when the anchor is the trace root after all', () => {
    render(
      <TraceDataPanelView
        {...baseProps}
        spans={nestedSpanFixture}
        anchorSpanId="root"
        usage={{ inputTokens: 12_500, outputTokens: 800, estimatedCost: 0.05, costUnit: 'usd' }}
      />,
    );

    // Anchoring on the root span is still the whole trace, so its totals stand.
    expect(screen.getByText('12.5K')).toBeTruthy();
  });
});

describe('TraceDataPanelView — downloading the trace', () => {
  const BASE_URL = 'http://localhost:4111';
  const server = setupServer();

  beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  const withClient = (children: ReactNode) => <MastraReactProvider baseUrl={BASE_URL}>{children}</MastraReactProvider>;

  it('refuses a second download while the first is still running', async () => {
    // The request never settles, so the button stays in its in-flight state.
    server.use(http.get(`${BASE_URL}/api/observability/traces/:traceId`, () => new Promise(() => {})));

    render(withClient(<TraceDataPanelView {...baseProps} />));

    const download = screen.getByRole('button', { name: 'Download trace JSON' });
    expect(download.hasAttribute('disabled')).toBe(false);

    fireEvent.click(download);

    await waitFor(() => expect(download.hasAttribute('disabled')).toBe(true));
  });
});

describe('TraceDataPanelView — what the timeline shows as selected', () => {
  /** The timeline tints the selected span's own row; nothing else carries it. */
  const isMarked = (name: string) => {
    let node: HTMLElement | null = screen.getByText(name);
    while (node) {
      if (node.classList.contains('bg-surface4')) return true;
      node = node.parentElement;
    }
    return false;
  };

  it('marks the span the URL asked for', () => {
    render(<TraceDataPanelView {...baseProps} spans={nestedSpanFixture} initialSpanId="child" />);

    expect(isMarked('weather tool')).toBe(true);
    expect(isMarked('agent run')).toBe(false);
  });

  it('marks nothing when the URL asked for a span the trace does not have', () => {
    render(<TraceDataPanelView {...baseProps} spans={nestedSpanFixture} initialSpanId="ghost" />);

    expect(isMarked('weather tool')).toBe(false);
    expect(isMarked('agent run')).toBe(false);
  });

  it('drops the mark when the URL stops asking for a span', () => {
    const { rerender } = render(<TraceDataPanelView {...baseProps} spans={nestedSpanFixture} initialSpanId="child" />);
    expect(isMarked('weather tool')).toBe(true);

    rerender(<TraceDataPanelView {...baseProps} spans={nestedSpanFixture} initialSpanId={undefined} />);

    expect(isMarked('weather tool')).toBe(false);
  });
});

describe('TraceDataPanelView — without the optional callbacks', () => {
  it('clears a missing span without a listener to tell', () => {
    expect(() =>
      render(<TraceDataPanelView {...baseProps} spans={nestedSpanFixture} initialSpanId="ghost" />),
    ).not.toThrow();
  });

  it('selects a span without a listener to tell', () => {
    render(<TraceDataPanelView {...baseProps} spans={nestedSpanFixture} />);

    expect(() => fireEvent.click(screen.getByText('weather tool'))).not.toThrow();
  });
});

describe('TraceDataPanelView — an anchor the trace does not have', () => {
  it('shows no trace summary rather than reaching into a span that is not there', () => {
    render(<TraceDataPanelView {...baseProps} spans={nestedSpanFixture} anchorSpanId="ghost" />);

    // No root span to describe, so the summary rows are left out entirely.
    expect(screen.queryByText('Status')).toBeNull();
    expect(screen.getByText('agent run')).toBeTruthy();
  });

  it('saves a dataset item with no root span rather than failing', () => {
    const onSaveAsDatasetItem = vi.fn();
    render(
      <TraceDataPanelView
        {...baseProps}
        spans={nestedSpanFixture}
        anchorSpanId="ghost"
        onSaveAsDatasetItem={onSaveAsDatasetItem}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /save as dataset item/i }));

    expect(onSaveAsDatasetItem).toHaveBeenCalledWith({ traceId: 'trace-1', rootSpanId: undefined });
  });

  it('copes with an anchor while the spans have not arrived', () => {
    expect(() => render(<TraceDataPanelView {...baseProps} spans={undefined} anchorSpanId="child" />)).not.toThrow();
    expect(screen.getByText('No spans found for this trace.')).toBeTruthy();
  });
});

describe('TraceDataPanelView — following the spans it is given', () => {
  it('re-reads the root span when the trace changes under it', () => {
    const onSaveAsDatasetItem = vi.fn();
    const { rerender } = render(
      <TraceDataPanelView {...baseProps} spans={rootSpanFixture} onSaveAsDatasetItem={onSaveAsDatasetItem} />,
    );

    const otherRoot = [{ ...(rootSpanFixture[0] as (typeof rootSpanFixture)[number]), spanId: 'other-root' }];
    rerender(<TraceDataPanelView {...baseProps} spans={otherRoot} onSaveAsDatasetItem={onSaveAsDatasetItem} />);

    fireEvent.click(screen.getByRole('button', { name: /save as dataset item/i }));

    expect(onSaveAsDatasetItem).toHaveBeenCalledWith({ traceId: 'trace-1', rootSpanId: 'other-root' });
  });

  it('re-reads the root span when the anchor changes under it', () => {
    const onSaveAsDatasetItem = vi.fn();
    const { rerender } = render(
      <TraceDataPanelView
        {...baseProps}
        spans={nestedSpanFixture}
        anchorSpanId="root"
        onSaveAsDatasetItem={onSaveAsDatasetItem}
      />,
    );

    rerender(
      <TraceDataPanelView
        {...baseProps}
        spans={nestedSpanFixture}
        anchorSpanId="child"
        onSaveAsDatasetItem={onSaveAsDatasetItem}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /save as dataset item/i }));

    expect(onSaveAsDatasetItem).toHaveBeenCalledWith({ traceId: 'trace-1', rootSpanId: 'child' });
  });

  it('picks the span with no parent, wherever it sits in the list', () => {
    const onSaveAsDatasetItem = vi.fn();
    render(
      <TraceDataPanelView
        {...baseProps}
        spans={[...nestedSpanFixture].reverse()}
        onSaveAsDatasetItem={onSaveAsDatasetItem}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /save as dataset item/i }));

    expect(onSaveAsDatasetItem).toHaveBeenCalledWith({ traceId: 'trace-1', rootSpanId: 'root' });
  });
});

describe('TraceDataPanelView — the actions row shape', () => {
  it('leaves out the row entirely when there is no action to put in it', () => {
    const actionRow = '.mb-6.flex.flex-wrap.items-center.justify-between';

    const withAction = render(<TraceDataPanelView {...baseProps} onEvaluateTrace={vi.fn()} />);
    expect(withAction.container.querySelector(actionRow)).not.toBeNull();

    cleanup();

    const withoutAction = render(<TraceDataPanelView {...baseProps} />);

    expect(withoutAction.container.querySelector(actionRow)).toBeNull();
  });
});

describe('TraceDataPanelView — following the URL to another span', () => {
  const isMarked = (name: string) => {
    let node: HTMLElement | null = screen.getByText(name);
    while (node) {
      if (node.classList.contains('bg-surface4')) return true;
      node = node.parentElement;
    }
    return false;
  };

  it('moves the mark when the URL names a different span', () => {
    const { rerender } = render(<TraceDataPanelView {...baseProps} spans={nestedSpanFixture} initialSpanId="root" />);
    expect(isMarked('agent run')).toBe(true);

    rerender(<TraceDataPanelView {...baseProps} spans={nestedSpanFixture} initialSpanId="child" />);

    expect(isMarked('weather tool')).toBe(true);
    expect(isMarked('agent run')).toBe(false);
  });

  it('clears the mark when the URL names a span the trace lost', () => {
    const { rerender } = render(<TraceDataPanelView {...baseProps} spans={nestedSpanFixture} initialSpanId="child" />);
    expect(isMarked('weather tool')).toBe(true);

    rerender(<TraceDataPanelView {...baseProps} spans={nestedSpanFixture} initialSpanId="ghost" />);

    expect(isMarked('weather tool')).toBe(false);
    expect(isMarked('agent run')).toBe(false);
  });
});

describe('TraceDataPanelView — how wide the timing chart sits', () => {
  it('keeps the narrow chart in the side panel and widens it on request', () => {
    const narrow = render(<TraceDataPanelView {...baseProps} />);
    expect(narrow.container.querySelector('.min-w-32')).not.toBeNull();
    expect(narrow.container.querySelector('.min-w-72')).toBeNull();

    cleanup();

    const wide = render(<TraceDataPanelView {...baseProps} timelineChartWidth="wide" />);
    expect(wide.container.querySelector('.min-w-72')).not.toBeNull();
    expect(wide.container.querySelector('.min-w-32')).toBeNull();
  });
});
