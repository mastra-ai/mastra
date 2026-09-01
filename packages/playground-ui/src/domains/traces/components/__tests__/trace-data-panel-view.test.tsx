// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { TraceDataPanelView } from '../trace-data-panel-view';
import type { TraceDataPanelViewProps } from '../trace-data-panel-view';
import { deepTraceFixture, nestedSpanFixture, rootSpanFixture } from './fixtures/trace-data-panel-view';
import { installHighlightApi } from '@/test/highlight-api';
import type { HighlightApiHarness } from '@/test/highlight-api';

const baseProps: TraceDataPanelViewProps = {
  traceId: 'trace-1',
  spans: rootSpanFixture,
  onClose: vi.fn(),
  placement: 'traces-list',
};

const openTraceActions = () => fireEvent.click(screen.getByRole('button', { name: 'Trace actions' }));

// jsdom has no layout, so it ships no scrollIntoView.
const scrollIntoView = vi.fn();
Element.prototype.scrollIntoView = scrollIntoView;

afterEach(() => {
  cleanup();
  scrollIntoView.mockClear();
});

describe('TraceDataPanelView — span panel slot', () => {
  it('renders the span panel content inside the same card, next to the trace content', () => {
    const { container } = render(
      <TraceDataPanelView {...baseProps} spanPanelSlot={<div data-testid="span-detail">span content</div>} />,
    );

    const spanDetail = screen.getByTestId('span-detail');
    // Same card: the slot lives inside the panel's single <section> root.
    expect(container.querySelector('section')?.contains(spanDetail)).toBe(true);
    // Trace content still renders alongside it.
    expect(screen.getByText(/agent run/i)).toBeTruthy();
  });

  it('renders no split when the slot is omitted', () => {
    render(<TraceDataPanelView {...baseProps} />);
    expect(screen.queryByTestId('span-detail')).toBeNull();
  });
});

describe('TraceDataPanelView — search highlighting', () => {
  let harness: HighlightApiHarness;

  beforeEach(() => {
    harness = installHighlightApi();
  });

  afterEach(() => {
    // Unmount first: the hook clears its registry entry on teardown.
    cleanup();
    harness.restore();
  });

  const renderWithSpanPanel = () =>
    render(
      <TraceDataPanelView
        {...baseProps}
        spanPanelSlot={
          <div data-testid="span-detail">
            <p>agent run details</p>
            <p>tool call</p>
          </div>
        }
      />,
    );

  const search = (value: string) => {
    fireEvent.change(screen.getByPlaceholderText('Search spans...'), { target: { value } });
  };

  it('highlights matching span names in the timeline tree', () => {
    render(<TraceDataPanelView {...baseProps} spans={nestedSpanFixture} />);

    search('weather');

    expect(harness.highlightedText()).toEqual(['weather']);
  });

  it('highlights matches in the timeline tree and the span panel at once', () => {
    renderWithSpanPanel();

    search('agent');

    // The tree row "agent run" plus "agent run details" in the span detail.
    expect(harness.highlightedText()).toEqual(['agent', 'agent']);
  });

  it('does not highlight the span type legend', () => {
    render(<TraceDataPanelView {...baseProps} spans={nestedSpanFixture} />);

    search('tool');

    // "weather tool" matches; the "Tool" legend label is chrome, not trace content.
    expect(harness.highlightedText()).toEqual(['tool']);
  });

  it('does not highlight the trace name in the panel header', () => {
    renderWithSpanPanel();

    search('agent');

    const heading = screen.getByRole('heading');
    expect(harness.highlightedIn().some(element => heading.contains(element))).toBe(false);
  });

  it('does not highlight the trace metadata above the timeline', () => {
    renderWithSpanPanel();

    // "Started at" is a metadata label, not span content.
    search('started');

    expect(harness.highlightedText()).toEqual([]);
  });

  it('waits for a second character before highlighting', () => {
    renderWithSpanPanel();

    search('a');

    expect(harness.highlights.set).not.toHaveBeenCalled();
  });

  it('paints the whole name of a span matched only by its metadata', async () => {
    render(<TraceDataPanelView {...baseProps} spans={deepTraceFixture} />);

    // 'pgvector' lives in the memory span's metadata and in no span name.
    search('pgvector');

    // The rows are marked once the filtered tree commits, one frame after the query.
    await waitFor(() => expect(harness.highlightedText('search-result-indirect')).toEqual(['memory lookup']));
    expect(harness.highlightedText()).toEqual([]);
  });

  it('leaves a span matched by its name on the normal highlight', async () => {
    render(<TraceDataPanelView {...baseProps} spans={deepTraceFixture} />);

    search('memory');

    await waitFor(() => expect(harness.highlightedText()).toEqual(['memory']));
    expect(harness.highlightedText('search-result-indirect')).toEqual([]);
  });

  it('removes the highlight when the search field is cleared', () => {
    renderWithSpanPanel();
    search('agent');
    harness.highlights.set.mockClear();

    search('');

    expect(harness.highlights.set).not.toHaveBeenCalled();
    expect(harness.highlights.delete).toHaveBeenCalledWith('search-result');
  });
});

describe('TraceDataPanelView — className passthrough', () => {
  it('applies the provided className to the panel root', () => {
    const { container } = render(<TraceDataPanelView {...baseProps} className="h-full" />);

    expect(container.querySelector('section')?.className).toContain('h-full');
  });
});

describe('TraceDataPanelView — Add tool mocks to item', () => {
  it('fires onAddTraceMocksToItem with the traceId when the button is clicked', () => {
    const onAddTraceMocksToItem = vi.fn();
    render(<TraceDataPanelView {...baseProps} onAddTraceMocksToItem={onAddTraceMocksToItem} />);

    openTraceActions();
    fireEvent.click(screen.getByRole('menuitem', { name: /add tool mocks to item/i }));

    expect(onAddTraceMocksToItem).toHaveBeenCalledTimes(1);
    expect(onAddTraceMocksToItem).toHaveBeenCalledWith({ traceId: 'trace-1' });
  });

  it('does not render the action when the prop is omitted', () => {
    render(<TraceDataPanelView {...baseProps} />);

    openTraceActions();
    expect(screen.queryByRole('menuitem', { name: /add tool mocks to item/i })).toBeNull();
  });
});

describe('TraceDataPanelView — header actions', () => {
  it('keeps navigation and close visible while secondary actions stay in the menu', () => {
    render(<TraceDataPanelView {...baseProps} onPrevious={vi.fn()} onNext={vi.fn()} onEvaluateTrace={vi.fn()} />);

    expect(screen.getByRole('button', { name: /previous trace/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /next trace/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /close panel/i })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: /evaluate trace/i })).toBeNull();

    openTraceActions();
    expect(screen.getByRole('menuitem', { name: /evaluate trace/i })).toBeTruthy();
  });

  it('keeps the trace actions reachable in the header even while the panel is collapsed', () => {
    render(
      <TraceDataPanelView
        {...baseProps}
        collapsed
        onCollapsedChange={vi.fn()}
        onEvaluateTrace={vi.fn()}
        onSaveAsDatasetItem={vi.fn()}
        onAddTraceMocksToItem={vi.fn()}
      />,
    );

    // The body is hidden while collapsed, so these can only come from the header menu.
    expect(screen.queryByText('agent run')).toBeNull();
    openTraceActions();
    expect(screen.getByRole('menuitem', { name: /evaluate trace/i })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /add full trace to dataset/i })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /add tool mocks to item/i })).toBeTruthy();
  });

  it('still saves the dataset item against the root span from the header', () => {
    const onSaveAsDatasetItem = vi.fn();
    render(
      <TraceDataPanelView
        {...baseProps}
        collapsed
        onCollapsedChange={vi.fn()}
        onSaveAsDatasetItem={onSaveAsDatasetItem}
      />,
    );

    openTraceActions();
    fireEvent.click(screen.getByRole('menuitem', { name: /add full trace to dataset/i }));

    expect(onSaveAsDatasetItem).toHaveBeenCalledWith({ traceId: 'trace-1', rootSpanId: 'root' });
  });
});

describe('TraceDataPanelView — trace summary description', () => {
  it('shows the start date, duration and entity right under the heading', () => {
    render(<TraceDataPanelView {...baseProps} spans={deepTraceFixture} entityHref="/agents/weather-agent/chat/new" />);

    expect(screen.getByLabelText(/^Started at /)).toBeTruthy();
    // 1s between the fixture's startedAt and endedAt.
    expect(screen.getAllByText('1.0s').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /weather-agent/ })).toBeTruthy();
  });

  it('renders the entity as plain text when no href is provided', () => {
    render(<TraceDataPanelView {...baseProps} spans={deepTraceFixture} />);

    expect(screen.queryByRole('link', { name: /weather-agent/ })).toBeNull();
    expect(screen.getAllByText(/weather-agent/).length).toBeGreaterThan(0);
  });

  it('no longer renders the old key-value metadata rows', () => {
    render(<TraceDataPanelView {...baseProps} />);

    expect(screen.queryByText('Status')).toBeNull();
    expect(screen.queryByText('Ended at')).toBeNull();
    expect(screen.queryByText('Trace input tokens')).toBeNull();
    expect(screen.queryByText('Trace est. cost')).toBeNull();
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
    openTraceActions();
    expect(screen.queryByRole('menuitem', { name: /collapse panel/i })).toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Download trace JSON' })).toBeTruthy();
  });

  it('offers a collapse toggle only to a caller that owns the state', () => {
    const uncontrolled = render(<TraceDataPanelView {...baseProps} />);
    expect(screen.queryByRole('button', { name: /collapse panel/i })).toBeNull();
    expect(uncontrolled.container).toBeTruthy();

    cleanup();

    const onCollapsedChange = vi.fn();
    render(<TraceDataPanelView {...baseProps} onCollapsedChange={onCollapsedChange} />);

    openTraceActions();
    fireEvent.click(screen.getByRole('menuitem', { name: /collapse panel/i }));
    expect(onCollapsedChange).toHaveBeenCalledWith(true);
  });

  it('reads its collapsed label from the state the caller passes in', () => {
    render(<TraceDataPanelView {...baseProps} collapsed onCollapsedChange={vi.fn()} />);

    openTraceActions();
    expect(screen.getByRole('menuitem', { name: /expand panel/i })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: /collapse panel/i })).toBeNull();
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
    openTraceActions();
    expect(screen.queryByRole('menuitem', { name: 'Open trace page' })).toBeNull();
    expect(noHref.container).toBeTruthy();

    cleanup();

    render(<TraceDataPanelView {...baseProps} traceHref="/traces/trace-1" />);
    openTraceActions();
    expect(screen.queryByRole('menuitem', { name: 'Open trace page' })).toBeNull();

    cleanup();

    render(<TraceDataPanelView {...baseProps} />);
    openTraceActions();
    expect(screen.queryByRole('menuitem', { name: 'Open trace page' })).toBeNull();

    cleanup();

    render(<TraceDataPanelView {...baseProps} LinkComponent={Anchor} traceHref="/traces/trace-1" />);
    openTraceActions();
    expect(screen.getByRole('menuitem', { name: 'Open trace page' }).getAttribute('href')).toBe('/traces/trace-1');
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

    openTraceActions();
    expect(screen.queryByRole('menuitem', { name: 'Open trace page' })).toBeNull();
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
    expect(screen.getByLabelText(/^Started at /)).toBeTruthy();
    expect(sidePanel.container).toBeTruthy();

    cleanup();

    render(<TraceDataPanelView {...baseProps} placement="trace-page" />);
    expect(screen.queryByLabelText(/^Started at /)).toBeNull();
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
    openTraceActions();
    expect(screen.getByRole('menuitem', { name: /evaluate trace/i })).toBeTruthy();
  });

  it('never shows the actions row on the trace page', () => {
    render(<TraceDataPanelView {...baseProps} placement="trace-page" onEvaluateTrace={vi.fn()} />);

    openTraceActions();
    expect(screen.queryByRole('menuitem', { name: /evaluate trace/i })).toBeNull();
    expect(screen.queryByText(/available in Mastra Studio/)).toBeNull();
  });

  it('saves the dataset item against the root span it found', () => {
    const onSaveAsDatasetItem = vi.fn();
    render(<TraceDataPanelView {...baseProps} onSaveAsDatasetItem={onSaveAsDatasetItem} />);

    openTraceActions();
    fireEvent.click(screen.getByRole('menuitem', { name: /add full trace to dataset/i }));

    expect(onSaveAsDatasetItem).toHaveBeenCalledWith({ traceId: 'trace-1', rootSpanId: 'root' });
  });

  it('reports the evaluation request with no arguments of its own', () => {
    const onEvaluateTrace = vi.fn();
    render(<TraceDataPanelView {...baseProps} onEvaluateTrace={onEvaluateTrace} />);

    openTraceActions();
    fireEvent.click(screen.getByRole('menuitem', { name: /evaluate trace/i }));

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

    openTraceActions();
    fireEvent.click(screen.getByRole('menuitem', { name: /add full trace to dataset/i }));

    expect(onSaveAsDatasetItem).toHaveBeenCalledWith({ traceId: 'trace-1', rootSpanId: 'child' });
  });

  it('falls back to the span with no parent when there is no anchor', () => {
    const onSaveAsDatasetItem = vi.fn();
    render(<TraceDataPanelView {...baseProps} spans={nestedSpanFixture} onSaveAsDatasetItem={onSaveAsDatasetItem} />);

    openTraceActions();
    fireEvent.click(screen.getByRole('menuitem', { name: /add full trace to dataset/i }));

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

    openTraceActions();
    fireEvent.click(screen.getByRole('menuitem', { name: /add full trace to dataset/i }));

    expect(onSaveAsDatasetItem).toHaveBeenCalledWith({ traceId: 'trace-1', rootSpanId: 'root' });
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

    openTraceActions();
    const download = screen.getByRole('menuitem', { name: 'Download trace JSON' });
    expect(download.hasAttribute('data-disabled')).toBe(false);

    fireEvent.click(download);

    await waitFor(() => expect(screen.queryByRole('menuitem', { name: 'Download trace JSON' })).toBeNull());
    openTraceActions();
    await waitFor(() =>
      expect(screen.getByRole('menuitem', { name: 'Download trace JSON' }).hasAttribute('data-disabled')).toBe(true),
    );
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
    expect(screen.queryByLabelText(/^Started at /)).toBeNull();
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

    openTraceActions();
    fireEvent.click(screen.getByRole('menuitem', { name: /add full trace to dataset/i }));

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

    openTraceActions();
    fireEvent.click(screen.getByRole('menuitem', { name: /add full trace to dataset/i }));

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

    openTraceActions();
    fireEvent.click(screen.getByRole('menuitem', { name: /add full trace to dataset/i }));

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

    openTraceActions();
    fireEvent.click(screen.getByRole('menuitem', { name: /add full trace to dataset/i }));

    expect(onSaveAsDatasetItem).toHaveBeenCalledWith({ traceId: 'trace-1', rootSpanId: 'root' });
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

describe('TraceDataPanelView — trace-level tabs', () => {
  it('renders no tabs when no scores slot is provided', () => {
    render(<TraceDataPanelView {...baseProps} />);

    expect(screen.queryByRole('tab', { name: /spans/i })).toBeNull();
    expect(screen.queryByRole('tab', { name: /evaluations/i })).toBeNull();
  });

  it('renders Spans and Scores tabs when a scores slot is provided', () => {
    render(<TraceDataPanelView {...baseProps} scoresTabSlot={() => <div>trace scores here</div>} />);

    expect(screen.getByRole('tab', { name: /spans/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /evaluations/i })).toBeTruthy();
    // Spans is the default tab.
    expect(screen.getByText('agent run')).toBeTruthy();
    expect(screen.queryByText('trace scores here')).toBeNull();
  });

  it('shows the scores slot with the trace and root span when the Scores tab is active', () => {
    const scoresTabSlot = vi.fn(({ traceId, rootSpanId }: { traceId: string; rootSpanId: string | undefined }) => (
      <div>
        scores for {traceId}/{rootSpanId}
      </div>
    ));
    render(
      <TraceDataPanelView {...baseProps} activeTab="scores" onTabChange={vi.fn()} scoresTabSlot={scoresTabSlot} />,
    );

    expect(scoresTabSlot).toHaveBeenCalledWith({ traceId: 'trace-1', rootSpanId: 'root' });
    expect(screen.getByText('scores for trace-1/root')).toBeTruthy();
  });

  it('notifies the consumer when the user switches tabs', () => {
    const onTabChange = vi.fn();
    render(
      <TraceDataPanelView
        {...baseProps}
        activeTab="details"
        onTabChange={onTabChange}
        scoresTabSlot={() => <div>trace scores here</div>}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: /evaluations/i }));

    expect(onTabChange).toHaveBeenCalledWith('scores');
  });

  it('shows the badge count in the Scores tab label', () => {
    render(<TraceDataPanelView {...baseProps} scoresTabSlot={() => null} scoresTabBadge={3} />);

    expect(screen.getByRole('tab', { name: /evaluations \(3\)/i })).toBeTruthy();
  });
});

describe('TraceDataPanelView — trace feedback tab', () => {
  it('renders a Feedback tab next to Spans and Evaluations', () => {
    render(
      <TraceDataPanelView
        {...baseProps}
        scoresTabSlot={() => <div>trace scores here</div>}
        feedbackTabSlot={() => <div>trace feedback here</div>}
      />,
    );

    expect(screen.getByRole('tab', { name: /spans/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /evaluations/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /feedback/i })).toBeTruthy();
  });

  it('renders the Feedback tab even when no scores slot is provided', () => {
    render(<TraceDataPanelView {...baseProps} feedbackTabSlot={() => <div>trace feedback here</div>} />);

    expect(screen.getByRole('tab', { name: /feedback/i })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: /evaluations/i })).toBeNull();
  });

  it('shows the feedback slot with the trace id — and no span id — when the tab is active', () => {
    const feedbackTabSlot = vi.fn(({ traceId }: { traceId: string }) => <div>feedback for {traceId}</div>);
    render(
      <TraceDataPanelView
        {...baseProps}
        activeTab="feedback"
        onTabChange={vi.fn()}
        feedbackTabSlot={feedbackTabSlot}
      />,
    );

    expect(feedbackTabSlot).toHaveBeenCalledWith({ traceId: 'trace-1' });
    expect(screen.getByText('feedback for trace-1')).toBeTruthy();
  });

  it('shows the badge count in the Feedback tab label', () => {
    render(<TraceDataPanelView {...baseProps} feedbackTabSlot={() => null} feedbackTabBadge={2} />);

    expect(screen.getByRole('tab', { name: /feedback \(2\)/i })).toBeTruthy();
  });

  it('renders no tabs when neither slot is provided', () => {
    render(<TraceDataPanelView {...baseProps} />);

    expect(screen.queryByRole('tab', { name: /feedback/i })).toBeNull();
    expect(screen.queryByRole('tab', { name: /spans/i })).toBeNull();
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

describe('TraceDataPanelView — span search', () => {
  const searchField = () => screen.getByRole('textbox', { name: /search spans/i }) as HTMLInputElement;

  const typeSearch = (value: string) => {
    fireEvent.change(searchField(), { target: { value } });
  };

  // Reads the timeline rows in DOM order, so a test can assert both which spans
  // survived the filter and that a parent still precedes its child.
  const visibleSpanNames = () =>
    Array.from(document.querySelectorAll('[aria-label^="View details for span "]')).map(node =>
      (node.getAttribute('aria-label') ?? '').replace('View details for span ', ''),
    );

  it('renders the search field when the trace has spans', () => {
    render(<TraceDataPanelView {...baseProps} spans={deepTraceFixture} />);

    expect(searchField()).toBeTruthy();
  });

  it('renders no search field when the trace has no spans', () => {
    render(<TraceDataPanelView {...baseProps} spans={[]} />);

    expect(screen.getByText(/no spans found for this trace/i)).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: /search spans/i })).toBeNull();
  });

  const renderDeep = (props: Partial<TraceDataPanelViewProps> = {}) =>
    render(<TraceDataPanelView {...baseProps} spans={deepTraceFixture} {...props} />);

  const allNames = [
    'agent run',
    'llm generation',
    'weather tool',
    'http fetch',
    'memory lookup',
    'workflow run',
    'step normalize',
    'llm generation',
  ];

  const weatherBranch = ['agent run', 'llm generation', 'weather tool', 'http fetch'];

  it('keeps the whole ancestor chain when a leaf matches by name', async () => {
    renderDeep();

    typeSearch('http fetch');

    await waitFor(() => expect(visibleSpanNames()).toEqual(weatherBranch));
  });

  it('keeps the ancestor chain when a leaf matches on its input preview only', async () => {
    renderDeep();

    typeSearch('api.weather.test');

    await waitFor(() => expect(visibleSpanNames()).toEqual(weatherBranch));
  });

  it('matches on a nested metadata value, which no fixed field list reaches', async () => {
    renderDeep();

    typeSearch('pgvector');

    await waitFor(() => expect(visibleSpanNames()).toEqual(['agent run', 'llm generation', 'memory lookup']));
  });

  it('matches on a metadata key, so a payload shape is searchable', async () => {
    renderDeep();

    typeSearch('vendor');

    await waitFor(() => expect(visibleSpanNames()).toEqual(['agent run', 'llm generation', 'memory lookup']));
  });

  it('keeps both the ancestors and the subtree of a matching middle span', async () => {
    renderDeep();

    typeSearch('weather tool');

    await waitFor(() => expect(visibleSpanNames()).toEqual(weatherBranch));
  });

  it('renders the same branch when the trace arrives newest-first', async () => {
    // The trace list API defaults to `direction: 'DESC'`. The hierarchy
    // formatter re-sorts by `startedAt`, so the rows must come out identical.
    renderDeep({ spans: [...deepTraceFixture].reverse() });

    typeSearch('weather tool');

    await waitFor(() => expect(visibleSpanNames()).toEqual(weatherBranch));
  });

  it('expands the subtree of a middle span matched on metadata only', async () => {
    renderDeep();

    typeSearch('Lyon');

    await waitFor(() => expect(visibleSpanNames()).toEqual(weatherBranch));
  });

  it('keeps the entire trace when the root matches', async () => {
    renderDeep();

    typeSearch('agent run');

    await waitFor(() => expect(visibleSpanNames()).toEqual(allNames));
  });

  it('keeps both ancestor chains when a query matches spans on two branches', async () => {
    renderDeep();

    typeSearch('llm generation');

    await waitFor(() =>
      expect(visibleSpanNames()).toEqual([
        'agent run',
        'llm generation',
        'weather tool',
        'http fetch',
        'memory lookup',
        'workflow run',
        'llm generation',
      ]),
    );
  });

  it('matches on span type', async () => {
    renderDeep();

    typeSearch('memory_operation');

    await waitFor(() => expect(visibleSpanNames()).toEqual(['agent run', 'llm generation', 'memory lookup']));
  });

  it('matches on spanId', async () => {
    renderDeep();

    typeSearch('step-1');

    await waitFor(() => expect(visibleSpanNames()).toEqual(['agent run', 'workflow run', 'step normalize']));
  });

  it('matches case-insensitively', async () => {
    renderDeep();

    typeSearch('WEATHER TOOL');

    await waitFor(() => expect(visibleSpanNames()).toEqual(weatherBranch));
  });

  it('treats a whitespace-only query as empty', async () => {
    renderDeep();

    typeSearch('   ');

    await waitFor(() => expect(visibleSpanNames()).toEqual(allNames));
  });

  it('keeps the search field mounted when nothing matches', async () => {
    renderDeep();

    typeSearch('zzz-nothing');

    await waitFor(() => expect(screen.getByText(/no spans match your search/i)).toBeTruthy());
    expect(visibleSpanNames()).toEqual([]);
    // The field must survive a zero-result query, or the user could never undo it.
    expect(searchField().value).toBe('zzz-nothing');
  });

  it('sits on the same row as the span type legend', () => {
    renderDeep();

    // The legend is right-aligned on its own row; the search field fills the
    // empty left half of that row rather than taking a row of its own.
    const legendRow = screen.getByText('Tool').closest('div')?.parentElement;

    expect(legendRow?.contains(searchField())).toBe(true);
  });

  it('restores the full trace when the query is cleared', async () => {
    renderDeep();

    typeSearch('http fetch');
    await waitFor(() => expect(visibleSpanNames()).toEqual(weatherBranch));

    fireEvent.click(screen.getByRole('button', { name: /clear search/i }));

    await waitFor(() => expect(visibleSpanNames()).toEqual(allNames));
    expect(searchField().value).toBe('');
  });

  it('keeps the trace header on the unfiltered root while a query is active', async () => {
    renderDeep();

    // A zero-result query empties the filtered list entirely, so the header can
    // only still name the root if it reads the unfiltered spans.
    typeSearch('zzz-nothing');

    await waitFor(() => expect(visibleSpanNames()).toEqual([]));
    expect(screen.getAllByText(/weather-agent/i).length).toBeGreaterThan(0);
  });

  it('keeps the anchor span as the displayed root when filtering a branch subtree', async () => {
    // A branch subtree is what `getBranch` returns: the anchor plus its
    // descendants, without the trace root.
    const branch = deepTraceFixture.filter(span => ['gen-1', 'tool-1', 'http-1', 'mem-1'].includes(span.spanId));
    render(<TraceDataPanelView {...baseProps} spans={branch} anchorSpanId="gen-1" />);

    typeSearch('Lyon');

    await waitFor(() => expect(visibleSpanNames()).toEqual(['llm generation', 'weather tool', 'http fetch']));
  });
});
