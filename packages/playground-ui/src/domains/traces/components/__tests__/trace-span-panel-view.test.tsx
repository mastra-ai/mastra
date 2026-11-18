// @vitest-environment jsdom
import '@/test/inert-resize-observer';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { TraceSpanPanelView } from '../trace-span-panel-view';
import type { TraceSpanPanelViewProps } from '../trace-span-panel-view';
import { TRACE_ID, panelTraceSpans, spanDetailById } from './fixtures/trace-span-panel';
import { panelScorers, skillSignalTraceSpans } from './fixtures/trace-span-panel-view';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { recordRequests } from '@/test/record-requests';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

// jsdom reports zero-sized elements; give them a real size so the virtualized span tree
// materializes its rows.
const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
beforeAll(() => {
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 800 });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 800 });
  // Base UI switches and comboboxes dispatch pointer events, which jsdom does not provide.
  vi.stubGlobal('PointerEvent', MouseEvent);
});
afterAll(() => {
  if (originalOffsetHeight) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight);
  if (originalOffsetWidth) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidth);
  vi.unstubAllGlobals();
});

/** The chat message renderer resolves MCP app tools; it belongs to the chat domain, not to this panel. */
const MCP_APP_TOOLS_LOOKUP = '/api/mcp/v0/servers';
const serveMcpAppToolsLookup = () =>
  server.use(http.get(`${TEST_BASE_URL}${MCP_APP_TOOLS_LOOKUP}`, () => HttpResponse.json({ servers: [] })));

/**
 * The panel as a host composes it: span selection is the host's state, and every record the
 * panel shows (the selected span included) is handed down rather than fetched.
 */
function Host({
  initialSpanId = null,
  onSpanSelect,
  ...props
}: Partial<TraceSpanPanelViewProps> & { initialSpanId?: string | null }) {
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(initialSpanId);
  return (
    <TraceSpanPanelView
      traceId={TRACE_ID}
      spans={panelTraceSpans.spans}
      isLoadingSpans={false}
      selectedSpanId={selectedSpanId}
      selectedSpan={selectedSpanId ? spanDetailById[selectedSpanId]?.span : undefined}
      onSpanSelect={spanId => {
        setSelectedSpanId(spanId ?? null);
        onSpanSelect?.(spanId);
      }}
      onClose={() => {}}
      {...props}
    />
  );
}

const renderPanel = (props: Partial<TraceSpanPanelViewProps> & { initialSpanId?: string | null } = {}) =>
  renderWithProviders(
    <TestLinkProvider>
      <Host {...props} />
    </TestLinkProvider>,
  );

/** A span row in the tree, not the open span panel's header that repeats its title. */
const treeRow = (title: string) => {
  const row = screen.getAllByText(title).find(element => !element.closest('[data-slot="span-data-panel"]'));
  if (!row) throw new Error(`No tree row titled ${title}`);
  return row;
};

describe('TraceSpanPanelView', () => {
  describe('when the trace spans come from the props', () => {
    it('draws the span tree of the given trace', async () => {
      renderPanel();

      expect(await screen.findByText('Root agent run')).toBeTruthy();
      expect(screen.getByText('First tool call')).toBeTruthy();
      expect(screen.getByText('Second tool call')).toBeTruthy();
    });

    it('sends no request to the Mastra server', async () => {
      const requests = recordRequests();
      const { queryClient } = renderPanel({ initialSpanId: 'child1' });

      await screen.findByRole('region', { name: 'First tool call' });
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));

      expect(requests).toEqual([]);
    });
  });

  describe('when the selected span record comes from the props', () => {
    it('shows that record beside the tree', async () => {
      renderPanel({ initialSpanId: 'child1' });

      const spanPanel = await screen.findByRole('region', { name: 'First tool call' });

      expect(within(spanPanel).getByText('session-42')).toBeTruthy();
    });

    it('shows the next record the host hands down once another span is picked', async () => {
      renderPanel({ initialSpanId: 'child1' });
      await screen.findByRole('region', { name: 'First tool call' });

      fireEvent.click(treeRow('Second tool call'));

      expect(await screen.findByRole('region', { name: 'Second tool call' })).toBeTruthy();
    });
  });

  describe('when the selected span record is still loading', () => {
    it('says so in the span column', async () => {
      renderPanel({ initialSpanId: 'child1', selectedSpan: undefined, isLoadingSelectedSpan: true });

      expect(await screen.findByText('Loading span details...')).toBeTruthy();
    });
  });

  describe('when the full trace comes from the props', () => {
    it('shows the turn it reconstructs in the Messages column', async () => {
      serveMcpAppToolsLookup();
      renderPanel({ showPartialThread: true, traceSpans: panelTraceSpans.spans });

      const messages = await screen.findByTestId('messages-panel');

      expect(await within(messages).findByText('Will it rain?')).toBeTruthy();
      expect(within(messages).getByText('No rain is expected.')).toBeTruthy();
    });

    it('asks the network for nothing but the chat renderer’s MCP app tools', async () => {
      serveMcpAppToolsLookup();
      const requests = recordRequests();
      const { queryClient } = renderPanel({ showPartialThread: true, traceSpans: panelTraceSpans.spans });

      await screen.findByText('No rain is expected.');
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));

      expect(requests.filter(path => path !== MCP_APP_TOOLS_LOOKUP)).toEqual([]);
    });

    it('badges the run a skill signal started with that skill', async () => {
      renderPanel({ traceSpans: skillSignalTraceSpans });

      const badge = await waitFor(() => {
        const element = document.querySelector('[data-slot="span-signal-badge"]');
        if (!element) throw new Error('no signal badge yet');
        return element;
      });

      expect(badge.textContent).toBe('Skill weather-check');
    });
  });

  describe('when the full trace is still loading', () => {
    it('shows the messages skeleton instead of an empty turn', async () => {
      renderPanel({ showPartialThread: true, isLoadingTraceSpans: true });

      const messages = await screen.findByTestId('messages-panel');

      expect(within(messages).getByRole('status', { name: 'Loading messages' })).toBeTruthy();
      expect(within(messages).queryByText('No agent turn found for this trace.')).toBeNull();
    });
  });

  describe('when the host says the thread has other traces', () => {
    it('opens the full thread through onOpenFullThread', async () => {
      serveMcpAppToolsLookup();
      const onOpenFullThread = vi.fn();
      renderPanel({
        showPartialThread: true,
        traceSpans: panelTraceSpans.spans,
        threadHasOtherTraces: true,
        onOpenFullThread,
      });

      fireEvent.click(await screen.findByRole('button', { name: 'Open full thread' }));

      expect(onOpenFullThread).toHaveBeenCalledOnce();
    });
  });

  describe('when the host says this trace is the only one in its thread', () => {
    it('offers no full thread', async () => {
      serveMcpAppToolsLookup();
      renderPanel({
        showPartialThread: true,
        traceSpans: panelTraceSpans.spans,
        threadHasOtherTraces: false,
        onOpenFullThread: vi.fn(),
      });

      await screen.findByText('No rain is expected.');

      expect(screen.queryByRole('button', { name: 'Open full thread' })).toBeNull();
    });
  });

  describe('when the host can start scorers', () => {
    it('starts the picked scorer on the root span through onTriggerScorer', async () => {
      const onTriggerScorer = vi.fn<NonNullable<TraceSpanPanelViewProps['onTriggerScorer']>>(() => Promise.resolve());
      renderPanel({ scorers: panelScorers, onTriggerScorer });

      fireEvent.click(await screen.findByRole('button', { name: 'Score trace' }));
      const dialog = await screen.findByRole('dialog', { name: 'Score trace' });
      fireEvent.click(within(dialog).getByRole('combobox', { name: 'Select scorer' }));
      fireEvent.click(await screen.findByRole('option', { name: 'Helpfulness' }));
      fireEvent.click(within(dialog).getByRole('button', { name: 'Start scoring' }));

      await waitFor(() =>
        expect(onTriggerScorer).toHaveBeenCalledWith({
          scorerName: 'helpfulness',
          traceId: TRACE_ID,
          spanId: 'root01',
        }),
      );
    });
  });

  describe('when the host cannot start scorers', () => {
    it('offers no Score trace action', async () => {
      renderPanel();

      await screen.findByText('Root agent run');

      expect(screen.queryByRole('button', { name: 'Score trace' })).toBeNull();
    });
  });

  describe('when the host can download the trace', () => {
    it('downloads it through onDownloadTrace', async () => {
      const onDownloadTrace = vi.fn<(traceId: string) => void>();
      renderPanel({ onDownloadTrace });

      fireEvent.click(await screen.findByRole('button', { name: 'Download trace JSON' }));

      expect(onDownloadTrace).toHaveBeenCalledWith(TRACE_ID);
    });
  });

  describe('when the host cannot download the trace', () => {
    it('offers no download', async () => {
      renderPanel();

      await screen.findByText('Root agent run');

      expect(screen.queryByRole('button', { name: 'Download trace JSON' })).toBeNull();
    });
  });

  describe('when the host searches the spans itself', () => {
    it('draws only the matches it hands down, keeping their ancestors', async () => {
      const childOne = panelTraceSpans.spans.find(span => span.spanId === 'child1');
      const root = panelTraceSpans.spans.find(span => span.spanId === 'root01');
      if (!childOne || !root) throw new Error('fixture spans missing');
      renderPanel({
        searchQuery: 'first',
        onSearchQueryChange: vi.fn(),
        searchResult: { results: [root, childOne], payloadOnlyMatchIds: new Set() },
      });

      await screen.findByText('First tool call');

      expect(screen.getByText('Root agent run')).toBeTruthy();
      expect(screen.queryByText('Second tool call')).toBeNull();
    });

    it('reports what the reader types through onSearchQueryChange', async () => {
      const onSearchQueryChange = vi.fn<(query: string) => void>();
      renderPanel({ searchQuery: '', onSearchQueryChange });

      fireEvent.change(await screen.findByRole('searchbox', { name: 'Search spans' }), {
        target: { value: 'tool' },
      });

      expect(onSearchQueryChange).toHaveBeenCalledWith('tool');
    });
  });
});
